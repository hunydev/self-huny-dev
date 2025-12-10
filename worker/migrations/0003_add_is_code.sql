-- Self App - Add Code Block Support
-- Migration: 0003_add_is_code.sql

-- Add is_code column to items table
ALTER TABLE items ADD COLUMN is_code INTEGER DEFAULT 0;
