-- Add user_id to items and tags tables
-- Migration: 0006_add_user_id.sql

-- Add user_id column to items table
ALTER TABLE items ADD COLUMN user_id TEXT;

-- Add user_id column to tags table
ALTER TABLE tags ADD COLUMN user_id TEXT;

-- Create indexes for user_id columns
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_items_user_created ON items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_user_type ON items(user_id, type);
