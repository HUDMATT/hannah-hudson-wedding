import { getHouseholdByCode, getHouseholdWithGuests } from "../../../server/guests.js";
import { error, json, originError, readJson, requireDb, sameOriginOrNoOrigin } from "../../../server/http.js";

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const code = new URL(context.request.url).searchParams.get("code");
  if (!code) return error("Invite code is required.", 400);

  const household = await getHouseholdWithGuests(db, await getHouseholdByCode(db, code));
  if (!household) return error("Invite code not found.", 404);
  return json({ household });
}

export async function onRequestPost(context) {
  const db = requireDb(context.env);
  if (!sameOriginOrNoOrigin(context.request)) return originError();
  const body = await readJson(context.request);
  if (!body || !body.code) return error("Invite code is required.", 400);

  const household = await getHouseholdByCode(db, body.code);
  if (!household) return error("Invite code not found.", 404);

  await db.batch([
    db.prepare(`
      INSERT INTO guest_info_updates (
        id, household_id, invite_code, submitted_name, submitted_phone,
        submitted_email, submitted_address, submitted_household_members
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      household.id,
      body.code,
      body.name || "",
      body.phone || "",
      body.email || "",
      body.address || "",
      body.householdMembers || ""
    ),
    db.prepare(`
      UPDATE households
      SET primary_name = COALESCE(NULLIF(?, ''), primary_name),
          phone = COALESCE(NULLIF(?, ''), phone),
          email = COALESCE(NULLIF(?, ''), email),
          mailing_address = COALESCE(NULLIF(?, ''), mailing_address),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(body.name || "", body.phone || "", body.email || "", body.address || "", household.id)
  ]);

  return json({ ok: true });
}
