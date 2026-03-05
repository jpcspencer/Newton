-- Create article_cache table for caching Kepler enrichment results
CREATE TABLE IF NOT EXISTS article_cache (
  url TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kepler_insight TEXT,
  importance_score INTEGER NOT NULL DEFAULT 3,
  kepler_summary TEXT,
  tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE article_cache ENABLE ROW LEVEL SECURITY;

-- Allow anon/service role to read and write (for API route)
CREATE POLICY "Allow public read" ON article_cache FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON article_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON article_cache FOR UPDATE USING (true);
