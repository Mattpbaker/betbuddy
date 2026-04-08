-- Allow teams and matches to exist without an API-Football ID
alter table teams alter column api_football_id drop not null;
alter table matches alter column api_football_id drop not null;

-- Allow teams to be upserted by name+competition
create unique index if not exists teams_name_competition_key on teams (name, competition);

-- Add Odds API event ID to matches (used as upsert key instead of api_football_id)
alter table matches add column if not exists odds_event_id text;
create unique index if not exists matches_odds_event_id_key on matches (odds_event_id);
