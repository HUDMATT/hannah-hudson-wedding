import { error, requireBucket, requireDb } from "../../../server/http.js";

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const bucket = requireBucket(context.env);
  const id = new URL(context.request.url).searchParams.get("id");
  if (!id) return error("Image id is required.", 400);

  const asset = await db.prepare("SELECT * FROM gallery_assets WHERE id = ?").bind(id).first();
  if (!asset) return error("Image not found.", 404);

  const object = await bucket.get(asset.r2_key);
  if (!object) return error("Image file not found.", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "no-store");
  headers.set("ETag", object.httpEtag);

  return new Response(object.body, { headers });
}
