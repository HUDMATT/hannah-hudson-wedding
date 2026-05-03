import { getAuthenticatedAdmin } from "../../../server/auth.js";
import { json, requireDb } from "../../../server/http.js";

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const admin = await getAuthenticatedAdmin(db, context.request);
  return json({ authenticated: Boolean(admin), admin: admin || null }, { status: admin ? 200 : 401 });
}

