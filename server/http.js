export function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init.headers || {})
    }
  });
}

export function error(message, status = 400) {
  return json({ error: message }, { status });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function requireDb(env) {
  if (!env.DB) throw new Error("Missing D1 binding: DB");
  return env.DB;
}

export function requireBucket(env) {
  if (!env.GALLERY_BUCKET) throw new Error("Missing R2 binding: GALLERY_BUCKET");
  return env.GALLERY_BUCKET;
}

export function sameOriginOrNoOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export function originError() {
  return error("Cross-origin requests are not allowed.", 403);
}
