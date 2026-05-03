import { hashPassword } from "../../server/auth.js";
import { error, json, originError, readJson, requireDb, sameOriginOrNoOrigin } from "../../server/http.js";

export async function onRequestPost(context) {
  const db = requireDb(context.env);
  if (!sameOriginOrNoOrigin(context.request)) return originError();
  const body = await readJson(context.request);

  if (!context.env.ADMIN_SETUP_SECRET) return error("ADMIN_SETUP_SECRET is not configured.", 500);
  if (!body || body.setupSecret !== context.env.ADMIN_SETUP_SECRET) return error("Unauthorized.", 401);
  if (!body.username || !body.password) return error("Username and password are required.", 400);

  const existingAdmin = await db.prepare("SELECT id FROM admins LIMIT 1").first();
  if (existingAdmin && context.env.ALLOW_ADMIN_RESET !== "true") {
    return error("Admin already exists. Set ALLOW_ADMIN_RESET=true temporarily to reset credentials.", 409);
  }

  const passwordHash = await hashPassword(body.password);
  await db.prepare(`
    INSERT INTO admins (id, username, password_hash, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO UPDATE SET
      password_hash = excluded.password_hash,
      updated_at = CURRENT_TIMESTAMP
  `).bind(crypto.randomUUID(), body.username, passwordHash).run();

  return json({ ok: true });
}
