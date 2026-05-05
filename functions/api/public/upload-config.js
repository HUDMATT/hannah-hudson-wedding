import { json } from "../../../server/http.js";

export async function onRequestGet(context) {
  return json({
    turnstileSiteKey: context.env.TURNSTILE_SITE_KEY || "",
    maxFiles: 10,
    maxFileSizeMb: 8
  });
}
