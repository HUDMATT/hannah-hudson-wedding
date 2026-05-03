import { missingFields } from "../../../server/guests.js";
import { error, json, originError, readJson, requireDb, sameOriginOrNoOrigin } from "../../../server/http.js";

async function listHouseholds(db) {
  const households = await db.prepare("SELECT * FROM households ORDER BY household_name").all();
  const guests = await db.prepare("SELECT * FROM guests ORDER BY household_id, sort_order, full_name").all();
  const guestsByHousehold = new Map();
  for (const guest of guests.results || []) {
    if (!guestsByHousehold.has(guest.household_id)) guestsByHousehold.set(guest.household_id, []);
    guestsByHousehold.get(guest.household_id).push(guest);
  }
  return (households.results || []).map((household) => ({
    ...household,
    missing_fields: missingFields(household),
    guests: guestsByHousehold.get(household.id) || []
  }));
}

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  return json({ households: await listHouseholds(db) });
}

export async function onRequestPost(context) {
  const db = requireDb(context.env);
  if (!sameOriginOrNoOrigin(context.request)) return originError();
  const body = await readJson(context.request);
  if (!body || !body.householdName || !body.inviteCode) return error("Household name and invite code are required.", 400);

  const householdId = body.id || crypto.randomUUID();
  await db.batch([
    db.prepare(`
      INSERT INTO households (
        id, household_name, primary_name, invite_code, phone, email,
        mailing_address, allowed_plus_ones, tags, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        household_name = excluded.household_name,
        primary_name = excluded.primary_name,
        invite_code = excluded.invite_code,
        phone = excluded.phone,
        email = excluded.email,
        mailing_address = excluded.mailing_address,
        allowed_plus_ones = excluded.allowed_plus_ones,
        tags = excluded.tags,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      householdId,
      body.householdName,
      body.primaryName || "",
      body.inviteCode,
      body.phone || "",
      body.email || "",
      body.address || "",
      Number(body.allowedPlusOnes || 0),
      body.tags || "",
      body.notes || ""
    ),
    db.prepare("DELETE FROM guests WHERE household_id = ?").bind(householdId),
    ...(body.guests || []).map((guest, index) => db.prepare(`
      INSERT INTO guests (id, household_id, full_name, guest_type, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).bind(guest.id || crypto.randomUUID(), householdId, guest.name, guest.type || "adult", index))
  ]);

  return json({ ok: true, householdId });
}

export async function onRequestDelete(context) {
  const db = requireDb(context.env);
  if (!sameOriginOrNoOrigin(context.request)) return originError();
  const id = new URL(context.request.url).searchParams.get("id");
  if (!id) return error("Household id is required.", 400);
  await db.prepare("DELETE FROM households WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
