import { getAccessUser } from "../../../server/access.js";
import { error, json, originError, readJson, requireBucket, requireDb, sameOriginOrNoOrigin } from "../../../server/http.js";

function publicAsset(asset) {
  return {
    ...asset,
    image_url: `/api/admin/gallery-image?id=${encodeURIComponent(asset.id)}`
  };
}

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const status = new URL(context.request.url).searchParams.get("status");
  const statement = status
    ? db.prepare("SELECT * FROM gallery_assets WHERE moderation_status = ? ORDER BY created_at DESC").bind(status)
    : db.prepare("SELECT * FROM gallery_assets ORDER BY created_at DESC");
  const result = await statement.all();
  return json({ assets: (result.results || []).map(publicAsset) });
}

export async function onRequestPost(context) {
  const db = requireDb(context.env);
  if (!sameOriginOrNoOrigin(context.request)) return originError();
  const admin = await getAccessUser(context.env, context.request);
  if (!admin) return error("Unauthorized", 401);

  const body = await readJson(context.request);
  if (!body || !body.id || !body.action) return error("Asset id and action are required.", 400);

  if (body.action === "approve") {
    await db.prepare(`
      UPDATE gallery_assets
      SET is_published = 1,
          moderation_status = 'approved',
          section = COALESCE(NULLIF(?, ''), section),
          title = COALESCE(NULLIF(?, ''), title),
          alt_text = COALESCE(NULLIF(?, ''), alt_text),
          approved_at = CURRENT_TIMESTAMP,
          approved_by = ?
      WHERE id = ?
    `).bind(body.section || "guest_uploads", body.title || "", body.altText || "", admin.email || admin.name, body.id).run();
    return json({ ok: true });
  }

  if (body.action === "unpublish") {
    await db.prepare(`
      UPDATE gallery_assets
      SET is_published = 0,
          moderation_status = 'pending',
          approved_at = NULL,
          approved_by = NULL
      WHERE id = ?
    `).bind(body.id).run();
    return json({ ok: true });
  }

  return error("Unsupported action.", 400);
}

export async function onRequestDelete(context) {
  const db = requireDb(context.env);
  const bucket = requireBucket(context.env);
  if (!sameOriginOrNoOrigin(context.request)) return originError();

  const id = new URL(context.request.url).searchParams.get("id");
  if (!id) return error("Asset id is required.", 400);

  const asset = await db.prepare("SELECT * FROM gallery_assets WHERE id = ?").bind(id).first();
  if (!asset) return error("Asset not found.", 404);

  await bucket.delete(asset.r2_key);
  await db.prepare("DELETE FROM gallery_assets WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
