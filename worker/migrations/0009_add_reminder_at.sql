-- Add reminder_at column for scheduling reminders
ALTER TABLE items ADD COLUMN reminder_at INTEGER;

-- Index for querying items with reminders
CREATE INDEX idx_items_reminder_at ON items(reminder_at) WHERE reminder_at IS NOT NULL;
