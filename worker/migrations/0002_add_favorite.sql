-- Migration: 0002_add_favorite.sql
-- Add favorite column to items table

ALTER TABLE items ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;

-- Index for filtering favorites
CREATE INDEX IF NOT EXISTS idx_items_is_favorite ON items(is_favorite);
