# Betbuddy — Design Spec
**Date:** 2026-04-07  
**Status:** Draft

---

## Context

A personal football betting research tool. The goal is to centralise everything needed before placing a bet — fixture schedules, multi-market odds, AI-generated research reports, and a draft bet slip — into a single always-available web app. The longer it runs, the smarter it gets: a growing football knowledge database means the AI agent spends less time fetching data it already has.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend + API | Next.js (App Router) | Full-stack in one deployment unit |
| Database | Supabase (PostgreSQL) | Managed, always-on, free tier sufficient for personal use |
| Hosting | Vercel | Zero-config Next.js deployment, always-up, free tier |
| Scheduling | Vercel Cron Jobs | Native to Vercel, no extra infra |
| AI | Anthropic Claude API (claude-sonnet-4-6) | Research reports and bet suggestions |
| Odds data | The Odds API (paid) | Full market coverage across all competitions |
| Football data | API-Football (paid) | Fixtures, results, lineups, player stats, form, injuries |

---

## Competitions Covered

**Top 5 European Leagues:** Premier League, La Liga, Bundesliga, Serie A, Ligue 1  
**Domestic Cups:** FA Cup, Copa del Rey, DFB-Pokal, Coppa Italia, Coupe de France  
**European:** UEFA Champions League, UEFA Europa League

---

## Architecture

```
Vercel (Next.js)
├── /app                   — Frontend pages (App Router)
│   ├── /                  — Dashboard: upcoming matches
│   ├── /matches/[id]      — Match detail: odds + AI report
│   └── /slip              — Full bet slip view
├── /app/api               — API routes
│   ├── /sync/fixtures     — Pull upcoming fixtures from API-Football
│   ├── /sync/odds         — Pull odds from The Odds API
│   ├── /reports/generate  — Trigger AI report for a match
│   └── /slip              — CRUD for draft bet slip
└── /app/api/cron          — Vercel cron handlers
    ├── /sync              — Runs every 6h: sync fixtures + odds
    └── /reports           — Runs 7am daily: auto-generate reports for next 48h

Supabase
└── PostgreSQL database (schema below)

External APIs
├── API-Football           — Fixtures, results, players, form, injuries
├── The Odds API           — Live odds across all markets
└── Anthropic Claude API   — AI research agent
```

---

## Database Schema

```sql
-- Core football data
teams            (id, name, country, competition, logo_url)
players          (id, team_id, name, position, nationality)
matches          (id, home_team_id, away_team_id, competition, date, venue, status)
match_results    (id, match_id, home_score, away_score, ht_score, home_corners, away_corners, home_cards, away_cards, fetched_at)
player_stats     (id, player_id, match_id, goals, assists, shots_on_target, yellow_cards, red_cards, minutes_played)

-- Computed / cached
team_form        (id, team_id, last_5_results JSONB, goals_scored_last5, goals_conceded_last5, updated_at)

-- Odds
odds             (id, match_id, market, selection, value, bookmaker, fetched_at)

-- AI Reports
reports          (id, match_id, content JSONB, generated_at, triggered_by)
-- content JSON shape: { form, h2h, squad, key_players, home_away_record,
--                       league_context, tactical_notes, conditions, suggestions[] }

-- Bet slip
bet_slip         (id, created_at, stake, total_odds, est_return, status)  -- status: draft | archived
bet_slip_items   (id, slip_id, match_id, market, selection, odds, report_id)
```

**Knowledge base strategy:** Before the AI agent fetches any data, it queries the database first. It only calls external APIs for data that is missing or stale (>24h for form/stats, >1h for odds). Over time, historical data accumulates and new-game research only requires fetching the most recent result.

---

## UI Layout

**Layout:** Sidebar navigation (icons) + main content area + persistent bet slip panel (right).  
**Theme:** Dark, data-dense, sports analytics aesthetic. Green accent (#2a9d5c). Monospace font for numbers/odds (DM Mono). Display font for headings (Rajdhani).

### Pages

**Dashboard (`/`)**
- Matches grouped by competition, sorted by date
- Each row: teams, date/time, live odds (1X2), AI report status badge, quick-add to slip
- Filter bar: by competition, by date range
- Cron status indicator (last sync time)

**Match Detail (`/matches/[id]`)**
- Match header: competition, teams, date, venue
- Odds panel: tabbed by market (Result, BTTS, O/U Goals, Corners, Cards, Shots, Asian Handicap)
  - Click any cell to add to slip
- AI Report:
  - Recent form bars (W/D/L last 5)
  - Key insights prose
  - Betting suggestions: label, reasoning, odds, confidence (High/Med/Low), "+ Slip" button
  - "Add All to Slip" button
  - Regenerate button (triggers fresh report)
- Report generation shows a loading state with section-by-section progress

**Bet Slip (persistent right panel + full page `/slip`)**
- List of selections with match, market, selection, odds, remove button
- Stake input
- Live accumulator odds and estimated return
- "View Full Slip" expands to full-page view with breakdown of single/acca options

---

## AI Research Agent

**Trigger:** Vercel cron (7am daily, all matches in next 48h) OR manual button on any match.

**Research criteria — every report covers these 9 sections:**

1. **Recent form** — last 5 results per team, goals scored/conceded, clean sheets
2. **Head-to-head** — last 5 meetings, average goals, home/away patterns
3. **Squad availability** — confirmed injuries, suspensions, doubtful players
4. **Key player form** — top performers last 3–5 games (goals, assists, cards, shots)
5. **Home/away record** — full-season split by venue
6. **League context** — table position, points gap, motivation (title race, relegation, Europe)
7. **Tactical/manager notes** — formation tendencies, pressing, set piece threat
8. **Conditions** — weather if available, pitch notes
9. **Betting suggestions** — 2–4 markets with odds, reasoning, confidence rating (High/Med/Low)

**Process:**
1. Query knowledge database for all available data on both teams
2. Identify what's missing or stale; fetch only those gaps from API-Football
3. Pass full context to Claude with a structured system prompt enforcing the 9-section schema
4. Store the report JSON in `reports` table
5. Return rendered report to frontend

**Output format:** Structured JSON stored in `reports.content`, rendered as rich UI on the match detail page.

---

## Scheduling

| Job | Schedule | Action |
|---|---|---|
| Fixture + odds sync | Every 6 hours | Pull fixtures for next 14 days; refresh odds for next 7 days |
| Auto report generation | 7am daily | Generate reports for all matches in next 48h without an existing report |

Manual overrides available on every match card and match detail page.

---

## Verification Plan

1. **Local dev:** `npm run dev` — app loads, Supabase connection works, fixtures display
2. **Fixture sync:** Hit `/api/sync/fixtures` manually, verify rows appear in `matches` table
3. **Odds sync:** Hit `/api/sync/odds`, verify `odds` rows for multiple markets per match
4. **Report generation:** Trigger report for one match, verify JSON stored in `reports`, report renders correctly in UI
5. **Bet slip:** Add selections from odds grid and from report suggestions, verify odds accumulate correctly, stake input updates estimated return
6. **Knowledge base reuse:** Run report generation twice for the same match, verify second run makes fewer external API calls
7. **Cron jobs:** Deploy to Vercel, verify cron logs show successful runs
8. **Full flow:** Browse dashboard → open match → read report → add suggestions to slip → review full slip
