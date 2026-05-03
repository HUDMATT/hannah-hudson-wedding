import { createSession, sessionCookie, verifyPassword } from "../../../server/auth.js";
import { error, json, originError, readJson, requireDb, sameOriginOrNoOrigin } from "../../../server/http.js";

export async function onRequestPost(context) {
  const db = requireDb(context.env);
  if (!sameOriginOrNoOrigin(context.request)) return originError();
  const body = await readJson(context.request);
  if (!body || !body.username || !body.password) return error("Username and password are required.", 400);

  const admin = await db.prepare("SELECT id, username, password_hash FROM admins WHERE username = ?")
    .bind(body.username)
    .first();

  if (!admin || !(await verifyPassword(body.password, admin.password_hash))) {
    return error("Invalid credentials.", 401);
  }

  const token = await createSession(db, admin.id);
  return json({ ok: true, admin: { id: admin.id, username: admin.username } }, {
    headers: { "Set-Cookie": sessionCookie(token) }
  });
}
