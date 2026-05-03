import { getHouseholdWithGuests } from "../../../server/guests.js";
import { error, json, requireDb } from "../../../server/http.js";

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const query = new URL(context.request.url).searchParams.get("q");
  if (!query) return error("Search query is required.", 400);

  const needle = `%${query}%`;
  const household = await db.prepare(`
    SELECT DISTINCT households.*
    FROM households
    LEFT JOIN guests ON guests.household_id = households.id
    WHERE households.invite_code = ?
       OR households.phone LIKE ?
       OR households.email LIKE ?
       OR households.household_name LIKE ?
       OR households.primary_name LIKE ?
       OR guests.full_name LIKE ?
    LIMIT 1
  `).bind(query, needle, needle, needle, needle, needle).first();

  if (!household) return error("No invitation matched that search.", 404);
  const householdWithGuests = await getHouseholdWithGuests(db, household);
  if (!normalize(JSON.stringify(householdWithGuests)).includes(normalize(query)) && household.invite_code !== query) {
    return error("No invitation matched that search.", 404);
  }
  return json({ household: householdWithGuests });
}

