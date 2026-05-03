import { missingFields } from "../../../server/guests.js";
import { json, requireDb } from "../../../server/http.js";

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const result = await db.prepare(`
    SELECT id, household_name, primary_name, invite_code, phone, email, mailing_address
    FROM households
    WHERE phone IS NULL OR phone = ''
       OR email IS NULL OR email = ''
       OR mailing_address IS NULL OR mailing_address = ''
    ORDER BY household_name
  `).all();

  const households = (result.results || []).map((household) => ({
    ...household,
    missing_fields: missingFields(household)
  }));
  return json({ count: households.length, households });
}

