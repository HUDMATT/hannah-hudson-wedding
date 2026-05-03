import { clearSessionCookie, deleteSession } from "../../../server/auth.js";
import { json, originError, requireDb, sameOriginOrNoOrigin } from "../../../server/http.js";

export async function onRequestPost(context) {
  const db = requireDb(context.env);
  if (!sameOriginOrNoOrigin(context.request)) return originError();
  await deleteSession(db, context.request);
  return json({ ok: true }, {
    headers: { "Set-Cookie": clearSessionCookie() }
  });
}
