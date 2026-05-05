import { error } from "./http.js";

let cachedCerts = null;
let cachedCertsUrl = "";
let cachedUntil = 0;

function accessConfig(env) {
  const teamDomain = String(env.CF_ACCESS_TEAM_DOMAIN || "").replace(/\/$/, "");
  const audience = env.CF_ACCESS_AUD;
  if (!teamDomain || !audience) return null;
  return {
    teamDomain: teamDomain.startsWith("https://") ? teamDomain : `https://${teamDomain}`,
    audience
  };
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64UrlToJson(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

async function getAccessCerts(teamDomain) {
  const certsUrl = `${teamDomain}/cdn-cgi/access/certs`;
  if (cachedCerts && cachedCertsUrl === certsUrl && Date.now() < cachedUntil) return cachedCerts;

  const response = await fetch(certsUrl);
  if (!response.ok) throw new Error("Could not load Cloudflare Access certificates.");

  const certs = await response.json();
  cachedCerts = certs.keys || [];
  cachedCertsUrl = certsUrl;
  cachedUntil = Date.now() + 10 * 60 * 1000;
  return cachedCerts;
}

async function verifyJwtSignature(token, config) {
  const [headerRaw, payloadRaw, signatureRaw] = token.split(".");
  if (!headerRaw || !payloadRaw || !signatureRaw) return null;

  const header = base64UrlToJson(headerRaw);
  const payload = base64UrlToJson(payloadRaw);
  const keys = await getAccessCerts(config.teamDomain);
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signatureRaw),
    new TextEncoder().encode(`${headerRaw}.${payloadRaw}`)
  );
  if (!verified) return null;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;
  if (payload.nbf && payload.nbf > now) return null;
  if (payload.iss !== config.teamDomain) return null;

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(config.audience)) return null;

  return payload;
}

export async function getAccessUser(env, request) {
  const config = accessConfig(env);
  if (!config) throw new Error("Cloudflare Access validation is not configured.");

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;

  const payload = await verifyJwtSignature(token, config);
  if (!payload) return null;

  return {
    email: payload.email || "",
    name: payload.name || payload.email || "Cloudflare Access user",
    payload
  };
}

export async function requireAccess(context) {
  let user = null;
  try {
    user = await getAccessUser(context.env, context.request);
  } catch (err) {
    return error(err.message || "Cloudflare Access validation failed.", 500);
  }
  if (!user) return error("Unauthorized", 401);
  context.data.admin = user;
  return context.next();
}
