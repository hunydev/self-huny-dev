-- Add expires_at column for auto-expiring items
ALTER TABLE items ADD COLUMN expires_at INTEGER;

-- Create index for efficient expiring items query
CREATE INDEX IF NOT EXISTS idx_items_expires_at ON items(expires_at);
