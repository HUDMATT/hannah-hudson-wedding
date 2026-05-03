export async function getHouseholdByCode(db, code) {
  return db.prepare("SELECT * FROM households WHERE invite_code = ?").bind(code).first();
}

export async function getGuestsForHousehold(db, householdId) {
  const result = await db.prepare(`
    SELECT id, full_name, guest_type, sort_order
    FROM guests
    WHERE household_id = ?
    ORDER BY sort_order, full_name
  `).bind(householdId).all();
  return result.results || [];
}

export async function getHouseholdWithGuests(db, household) {
  if (!household) return null;
  const guests = await getGuestsForHousehold(db, household.id);
  return { ...household, guests };
}

export function missingFields(household) {
  return [
    ["Phone", household.phone],
    ["Email", household.email],
    ["Mailing address", household.mailing_address]
  ].filter((field) => !String(field[1] || "").trim()).map((field) => field[0]);
}

