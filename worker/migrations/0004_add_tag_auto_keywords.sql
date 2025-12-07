-- Add auto_keywords column to tags table
-- auto_keywords stores a JSON array of keywords for auto-classification
ALTER TABLE tags ADD COLUMN auto_keywords TEXT;
