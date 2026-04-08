/*
  BETBUDDY DATABASE SCHEMA

  This SQL must be run in the Supabase SQL Editor (https://app.supabase.com).

  Instructions:
  1. Go to your Supabase project dashboard
  2. Click "SQL Editor" in the left sidebar
  3. Click "New query"
  4. Copy and paste the entire contents of this file
  5. Click "Run"

  This will create all tables for:
  - Football knowledge base (teams, players, matches, stats, form tracking)
  - Odds data
  - AI-generated match reports
  - Draft bet slip functionality
*/

-- Teams
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  api_football_id integer unique,
  name text not null,
  country text not null default '',
  competition text not null,
  logo_url text,
  created_at timestamptz default now(),
  unique(name, competition)
);

-- Players
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  api_football_id integer unique not null,
  team_id uuid references teams(id),
  name text not null,
  position text,
  nationality text,
  created_at timestamptz default now()
);

-- Matches
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  api_football_id integer unique,
  odds_event_id text unique,
  home_team_id uuid references teams(id),
  away_team_id uuid references teams(id),
  competition text not null,
  match_date timestamptz not null,
  venue text,
  status text default 'scheduled',
  created_at timestamptz default now()
);

-- Match results
create table if not exists match_results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid unique references matches(id),
  home_score integer,
  away_score integer,
  ht_home_score integer,
  ht_away_score integer,
  home_corners integer,
  away_corners integer,
  home_yellow_cards integer,
  away_yellow_cards integer,
  fetched_at timestamptz default now()
);

-- Player stats per match
create table if not exists player_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id),
  match_id uuid references matches(id),
  goals integer default 0,
  assists integer default 0,
  shots_on_target integer default 0,
  yellow_cards integer default 0,
  red_cards integer default 0,
  minutes_played integer default 0,
  unique(player_id, match_id)
);

-- Team form cache (last 5 results)
create table if not exists team_form (
  id uuid primary key default gen_random_uuid(),
  team_id uuid unique references teams(id),
  last_5_results jsonb not null default '[]',
  goals_scored_last5 integer default 0,
  goals_conceded_last5 integer default 0,
  updated_at timestamptz default now()
);

-- Odds
create table if not exists odds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id),
  market text not null,
  selection text not null,
  value numeric(6,2) not null,
  bookmaker text,
  fetched_at timestamptz default now(),
  unique(match_id, market, selection)
);

-- AI Reports
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid unique references matches(id),
  content jsonb not null,
  generated_at timestamptz default now(),
  triggered_by text default 'cron'
);

-- Bet slip (one active draft at a time)
create table if not exists bet_slip (
  id uuid primary key default gen_random_uuid(),
  stake numeric(8,2) default 10.00,
  status text default 'draft',  -- status: draft | archived
  created_at timestamptz default now()
);

-- Bet slip items
create table if not exists bet_slip_items (
  id uuid primary key default gen_random_uuid(),
  slip_id uuid references bet_slip(id) on delete cascade,
  match_id uuid references matches(id),
  market text not null,
  selection text not null,
  odds numeric(6,2) not null,
  report_id uuid references reports(id),
  created_at timestamptz default now()
);

-- =============================================================
-- MIGRATION: run this section if tables already existed above
-- (CREATE TABLE IF NOT EXISTS skips constraint changes)
-- =============================================================

-- Allow teams to exist without an API-Football ID
alter table teams alter column api_football_id drop not null;

-- Allow teams to be upserted by name+competition
alter table teams add constraint if not exists teams_name_competition_key unique (name, competition);

-- Add Odds API event ID to matches (used as upsert key instead of api_football_id)
alter table matches add column if not exists odds_event_id text;
alter table matches add constraint if not exists matches_odds_event_id_key unique (odds_event_id);
alter table matches alter column api_football_id drop not null;
