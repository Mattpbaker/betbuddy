-- supabase/migrations/20260408000003_rich_match_data.sql

-- Store announced lineups for upcoming fixtures
create table if not exists match_lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  team_id uuid references teams(id),
  formation text,
  start_xi jsonb not null default '[]',
  -- [{id, name, number, position, grid}]
  substitutes jsonb not null default '[]',
  coach_name text,
  fetched_at timestamptz default now(),
  unique(match_id, team_id)
);

-- Store in-match or post-match events (goals, cards, subs)
create table if not exists match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  team_id uuid references teams(id),
  elapsed integer,
  type text not null,   -- Goal | Card | Subst | Var
  detail text not null, -- Normal Goal | Yellow Card | Red Card | etc.
  player_name text,
  assist_name text,
  fetched_at timestamptz default now()
);

-- Store AI prediction data per fixture (Poisson-based)
create table if not exists match_predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid unique references matches(id) on delete cascade,
  winner_team_id integer,   -- API-Football team id of predicted winner (null = draw)
  winner_name text,
  win_or_draw boolean,
  under_over text,          -- e.g. "-2.5"
  advice text,
  home_win_percent text,
  draw_percent text,
  away_win_percent text,
  home_form text,
  away_form text,
  comparison jsonb,         -- full comparison object
  fetched_at timestamptz default now()
);

-- Add round and score columns to matches for quick display.
-- home_score/away_score/ht_* are denormalized from match_results for efficient list rendering; keep in sync when writing scores.
alter table matches add column if not exists round text;
alter table matches add column if not exists home_score integer;
alter table matches add column if not exists away_score integer;
alter table matches add column if not exists ht_home_score integer;
alter table matches add column if not exists ht_away_score integer;
