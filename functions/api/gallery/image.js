import { getAuthenticatedAdmin } from "../../../server/auth.js";
import { error, requireBucket, requireDb } from "../../../server/http.js";

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const bucket = requireBucket(context.env);
  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");
  const key = url.searchParams.get("key");

  let asset = null;
  if (id) {
    asset = await db.prepare("SELECT * FROM gallery_assets WHERE id = ?").bind(id).first();
  } else if (key) {
    asset = await db.prepare("SELECT * FROM gallery_assets WHERE r2_key = ?").bind(key).first();
  }

  if (!asset) return error("Image not found.", 404);

  if (!(asset.is_published === 1 && asset.moderation_status === "approved")) {
    const admin = await getAuthenticatedAdmin(db, context.request);
    if (!admin) return error("Image not found.", 404);
  }

  const object = await bucket.get(asset.r2_key);
  if (!object) return error("Image file not found.", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", asset.is_published === 1 ? "public, max-age=3600" : "no-store");
  headers.set("ETag", object.httpEtag);

  return new Response(object.body, { headers });
}
