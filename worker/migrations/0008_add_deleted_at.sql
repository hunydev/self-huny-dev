-- Add soft delete support
-- Items are moved to trash (deleted_at set) and permanently deleted after 30 days

ALTER TABLE items ADD COLUMN deleted_at INTEGER;

-- Index for efficient trash queries
CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_items_user_deleted ON items(user_id, deleted_at);
