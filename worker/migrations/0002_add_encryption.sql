-- Self App - Add Encryption Support
-- Migration: 0002_add_encryption.sql

-- Add encryption columns to items table
ALTER TABLE items ADD COLUMN is_encrypted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN encryption_hash TEXT;

-- Index for encrypted items filter
CREATE INDEX IF NOT EXISTS idx_items_is_encrypted ON items(is_encrypted);
