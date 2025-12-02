-- Migration: 0002_og_metadata.sql
-- Add Open Graph metadata columns for link items

ALTER TABLE items ADD COLUMN og_image TEXT;
ALTER TABLE items ADD COLUMN og_title TEXT;
ALTER TABLE items ADD COLUMN og_description TEXT;
