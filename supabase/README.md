# Supabase Setup

## Article Cache Migration

Run the migration to create the `article_cache` table. In the Supabase Dashboard:

1. Go to **SQL Editor**
2. Create a new query
3. Copy the contents of `migrations/20250305000000_create_article_cache.sql`
4. Run the query

The table caches Kepler enrichment results to reduce Claude API costs. Cached entries expire after 24 hours.
