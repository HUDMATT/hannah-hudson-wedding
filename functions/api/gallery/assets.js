import { json, requireDb } from "../../../server/http.js";

export async function onRequestGet(context) {
  const db = requireDb(context.env);
  const section = new URL(context.request.url).searchParams.get("section");
  const statement = section
    ? db.prepare("SELECT * FROM gallery_assets WHERE is_published = 1 AND section = ? ORDER BY sort_order, created_at").bind(section)
    : db.prepare("SELECT * FROM gallery_assets WHERE is_published = 1 ORDER BY section, sort_order, created_at");
  const result = await statement.all();
  return json({ assets: result.results || [] });
}

