import { error, json, originError, requireBucket, requireDb, sameOriginOrNoOrigin } from "../../../server/http.js";
import { verifyTurnstile } from "../../../server/turnstile.js";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
function extensionFor(file) {
  return "jpg";
}

export async function onRequestPost(context) {
  if (!sameOriginOrNoOrigin(context.request)) return originError();

  const db = requireDb(context.env);
  const bucket = requireBucket(context.env);
  const formData = await context.request.formData();
  const eventCode = String(formData.get("eventCode") || "").trim();
  const configuredCode = context.env.GUEST_UPLOAD_CODE;

  if (!configuredCode) return error("Guest upload code is not configured.", 500);
  if (!eventCode || eventCode !== configuredCode) return error("Upload link is invalid.", 403);

  const turnstile = await verifyTurnstile(context.env, formData.get("cf-turnstile-response"), context.request);
  if (!turnstile.success) return error("Verification failed. Please refresh and try again.", 400);

  const uploadedByName = String(formData.get("uploadedByName") || "").trim();
  const caption = String(formData.get("caption") || "").trim();
  const files = formData.getAll("photos").filter((file) => file && typeof file === "object" && file.size);

  if (!files.length) return error("Please choose at least one image.", 400);
  if (files.length > MAX_FILES) return error(`Please upload ${MAX_FILES} images or fewer at a time.`, 400);

  const inserted = [];
  for (const file of files) {
    if (file.type !== "image/jpeg") return error("Images must be converted to JPG before upload.", 400);
    if (file.size > MAX_FILE_SIZE) return error("Each image must be 8 MB or smaller.", 400);

    const id = crypto.randomUUID();
    const key = `guest-uploads/pending/${id}.${extensionFor(file)}`;
    try {
      await bucket.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: {
          uploadedByName,
          originalName: String(file.name || "")
        }
      });

      await db.prepare(`
        INSERT INTO gallery_assets (
          id, r2_key, title, alt_text, section, sort_order, is_published,
          uploaded_by_name, upload_source, moderation_status, content_type, file_size
        ) VALUES (?, ?, ?, ?, 'guest_uploads', 0, 0, ?, 'guest', 'pending', ?, ?)
      `).bind(
        id,
        key,
        caption || "Guest upload",
        caption || "Guest uploaded wedding photo",
        uploadedByName,
        file.type,
        file.size
      ).run();
    } catch (err) {
      await bucket.delete(key).catch(() => {});
      throw err;
    }

    inserted.push({ id, title: caption || "Guest upload" });
  }

  return json({ ok: true, count: inserted.length, assets: inserted });
}
