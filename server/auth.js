import { error } from "./http.js";

const SESSION_COOKIE = "hnw_admin_session";
const SESSION_DAYS = 7;

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const pairs = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(pairs.map((pair) => parseInt(pair, 16)));
}

async function digestHex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPassword(password, iterations = 100000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return `pbkdf2_sha256$${iterations}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, iterationsRaw, saltHex, expectedHex] = String(storedHash || "").split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsRaw || !saltHex || !expectedHex) return false;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: hexToBytes(saltHex),
    iterations: Number(iterationsRaw)
  }, key, 256);
  return bytesToHex(new Uint8Array(bits)) === expectedHex;
}

export function getSessionCookie(request) {
  const cookie = request.headers.get("Cookie") || "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.split("=")[1] || "";
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
}

export async function createSession(db, adminId) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToHex(tokenBytes);
  const tokenHash = await digestHex(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare(`
    INSERT INTO admin_sessions (id, admin_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(crypto.randomUUID(), adminId, tokenHash, expiresAt).run();
  return token;
}

export async function getAuthenticatedAdmin(db, request) {
  const token = getSessionCookie(request);
  if (!token) return null;
  const tokenHash = await digestHex(token);
  return db.prepare(`
    SELECT admins.id, admins.username
    FROM admin_sessions
    JOIN admins ON admins.id = admin_sessions.admin_id
    WHERE admin_sessions.token_hash = ? AND admin_sessions.expires_at > CURRENT_TIMESTAMP
  `).bind(tokenHash).first();
}

export async function deleteSession(db, request) {
  const token = getSessionCookie(request);
  if (!token) return;
  const tokenHash = await digestHex(token);
  await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function requireAdmin(context) {
  const admin = await getAuthenticatedAdmin(context.env.DB, context.request);
  if (!admin) return error("Unauthorized", 401);
  context.data.admin = admin;
  return context.next();
}
