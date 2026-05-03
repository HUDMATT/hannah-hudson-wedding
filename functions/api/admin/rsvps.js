import { json, requireDb } from "../../../server/http.js";

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const rsvps = await db.prepare(`
    SELECT rsvps.*, households.household_name, households.invite_code
    FROM rsvps
    JOIN households ON households.id = rsvps.household_id
    ORDER BY rsvps.updated_at DESC
  `).all();

  const attendees = await db.prepare(`
    SELECT rsvp_attendees.*
    FROM rsvp_attendees
    ORDER BY created_at
  `).all();

  const attendeesByRsvp = new Map();
  for (const attendee of attendees.results || []) {
    if (!attendeesByRsvp.has(attendee.rsvp_id)) attendeesByRsvp.set(attendee.rsvp_id, []);
    attendeesByRsvp.get(attendee.rsvp_id).push(attendee);
  }

  return json({
    rsvps: (rsvps.results || []).map((rsvp) => ({
      ...rsvp,
      attendees: attendeesByRsvp.get(rsvp.id) || []
    }))
  });
}

