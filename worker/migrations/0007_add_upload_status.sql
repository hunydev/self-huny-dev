-- Add upload_status column to items table for async file uploads
-- Migration: 0007_add_upload_status.sql

-- Add upload_status column: 'pending', 'uploading', 'completed', 'failed'
-- NULL means completed (for backward compatibility with existing items)
ALTER TABLE items ADD COLUMN upload_status TEXT;

-- Create index for querying pending uploads
CREATE INDEX IF NOT EXISTS idx_items_upload_status ON items(upload_status);
