-- Ensure unique constraint exists on odds table for upsert to work
-- (CREATE TABLE IF NOT EXISTS doesn't re-add constraints on existing tables)
create unique index if not exists odds_match_market_selection_key
  on odds (match_id, market, selection);
