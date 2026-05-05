ALTER TABLE gallery_assets ADD COLUMN uploaded_by_name TEXT;
ALTER TABLE gallery_assets ADD COLUMN upload_source TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE gallery_assets ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE gallery_assets ADD COLUMN approved_at TEXT;
ALTER TABLE gallery_assets ADD COLUMN approved_by TEXT;
ALTER TABLE gallery_assets ADD COLUMN content_type TEXT;
ALTER TABLE gallery_assets ADD COLUMN file_size INTEGER;

CREATE INDEX IF NOT EXISTS idx_gallery_assets_moderation_status ON gallery_assets(moderation_status);
CREATE INDEX IF NOT EXISTS idx_gallery_assets_published_status ON gallery_assets(is_published, moderation_status);
