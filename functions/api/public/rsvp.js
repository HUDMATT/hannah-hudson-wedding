import { getGuestsForHousehold, getHouseholdByCode } from "../../../server/guests.js";
import { error, json, originError, readJson, requireDb, sameOriginOrNoOrigin } from "../../../server/http.js";

export async function onRequestPost(context) {
  const db = requireDb(context.env);
  if (!sameOriginOrNoOrigin(context.request)) return originError();
  const body = await readJson(context.request);
  if (!body || !body.code || !body.status) return error("Invite code and status are required.", 400);

  const household = await getHouseholdByCode(db, body.code);
  if (!household) return error("Invite code not found.", 404);

  const guests = await getGuestsForHousehold(db, household.id);
  const rsvpId = crypto.randomUUID();
  const attendees = Array.isArray(body.attendees) ? body.attendees : [];
  const plusOne = body.plusOne && body.plusOne.name ? body.plusOne : null;

  const existingRsvp = await db.prepare("SELECT id FROM rsvps WHERE household_id = ?").bind(household.id).first();
  if (existingRsvp) {
    await db.prepare("DELETE FROM rsvp_attendees WHERE rsvp_id = ?").bind(existingRsvp.id).run();
    await db.prepare("DELETE FROM rsvps WHERE id = ?").bind(existingRsvp.id).run();
  }
  await db.prepare(`
    INSERT INTO rsvps (id, household_id, status, song_request, notes)
    VALUES (?, ?, ?, ?, ?)
  `).bind(rsvpId, household.id, body.status, body.song || "", body.notes || "").run();

  if (body.status === "attending") {
    const statements = attendees.map((attendee) => {
      const matchedGuest = guests.find((guest) => guest.id === attendee.guestId || guest.full_name === attendee.name);
      return db.prepare(`
        INSERT INTO rsvp_attendees (id, rsvp_id, guest_id, full_name, attendee_type)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        rsvpId,
        matchedGuest ? matchedGuest.id : null,
        attendee.name,
        attendee.type || (matchedGuest ? matchedGuest.guest_type : "adult")
      );
    });

    if (plusOne) {
      statements.push(db.prepare(`
        INSERT INTO rsvp_attendees (id, rsvp_id, guest_id, full_name, attendee_type)
        VALUES (?, ?, NULL, ?, 'plus_one')
      `).bind(crypto.randomUUID(), rsvpId, plusOne.name));
    }

    if (statements.length) await db.batch(statements);
  }

  return json({ ok: true });
}
