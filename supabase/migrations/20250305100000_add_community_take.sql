-- Add community_take column for Reddit community summaries
ALTER TABLE article_cache ADD COLUMN IF NOT EXISTS community_take TEXT;
