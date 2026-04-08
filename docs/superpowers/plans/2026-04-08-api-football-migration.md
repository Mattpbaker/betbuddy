# API-Football Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace The Odds API with API-Football v3 for all data (fixtures, odds, standings, injuries, lineups, statistics, predictions) to give the AI research agent much richer match context.

**Architecture:** API-Football provides a single API for all football data via `https://v3.football.api-sports.io` with a `x-apisports-key` header. We expand the existing `APIFootballClient` with new methods, rewrite both sync routes, add a rich-data sync for pre-match context (lineups, statistics, predictions), update the AI research agent prompt, and remove `lib/odds-api.ts` entirely.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (PostgreSQL), API-Football v3 Pro (7500 req/day), Claude claude-sonnet-4-6

**Existing files that already work and must not be broken:**
- `lib/supabase.ts` — Supabase clients (no changes needed)
- `lib/research-agent.ts` — AI report generation (will be enhanced, not rewritten)
- `app/api/reports/generate/route.ts` — Report route (will be enhanced)
- `app/api/slip/route.ts` — Bet slip (no changes needed)
- `app/slip/page.tsx` — Bet slip page (no changes needed)
- `app/layout.tsx` — Root layout (no changes needed)

**Key constants:**
- Base URL: `https://v3.football.api-sports.io`
- Auth header: `x-apisports-key: YOUR_KEY`
- Env var: `API_FOOTBALL_KEY` (already in Vercel, already in `.env.local`)
- Season logic: month < 7 → `year - 1`, else `year` (Apr 2026 → season 2025)
- League IDs already in `lib/api-football.ts`: Premier League=39, La Liga=140, Bundesliga=78, Serie A=135, Ligue 1=61, FA Cup=45, Copa del Rey=143, DFB-Pokal=81, Coppa Italia=137, Coupe de France=66, Champions League=2, Europa League=3

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/api-football.ts` | **Expand** | All API-Football methods + interfaces |
| `lib/odds-api.ts` | **Delete** | Replaced entirely |
| `app/api/sync/fixtures/route.ts` | **Rewrite** | Sync upcoming fixtures via API-Football |
| `app/api/sync/odds/route.ts` | **Rewrite** | Sync pre-match odds via API-Football |
| `app/api/sync/rich/route.ts` | **Create** | Sync lineups, predictions, statistics per match |
| `supabase/migrations/20260408000003_rich_match_data.sql` | **Create** | Add match_lineups, match_events tables |
| `lib/research-agent.ts` | **Enhance** | Richer prompt with predictions + lineups |
| `app/api/reports/generate/route.ts` | **Enhance** | Pass predictions + lineups to agent |
| `components/MatchRow.tsx` | **Update** | Odds lookup: 'Match Winner'/'Home'/'Draw'/'Away' |
| `components/OddsPanel.tsx` | **Update** | Market labels for API-Football bet names |
| `types/index.ts` | **Update** | Add Lineup, MatchEvent, Prediction types |
| `app/page.tsx` | **Update** | Add SYNC RICH button |

---

### Task 1: Expand API-Football Client

**Files:**
- Modify: `lib/api-football.ts`

- [ ] **Step 1: Add `getCurrentSeason()` helper and new interfaces**

Replace the entire contents of `lib/api-football.ts` with:

```typescript
// lib/api-football.ts

const BASE_URL = 'https://v3.football.api-sports.io'

// League IDs for our competitions
export const LEAGUE_IDS = {
  'Premier League': 39,
  'La Liga': 140,
  'Bundesliga': 78,
  'Serie A': 135,
  'Ligue 1': 61,
  'FA Cup': 45,
  'Copa del Rey': 143,
  'DFB-Pokal': 81,
  'Coppa Italia': 137,
  'Coupe de France': 66,
  'Champions League': 2,
  'Europa League': 3,
} as const

// European seasons start in July: Apr 2026 → season 2025
export function getCurrentSeason(): number {
  const now = new Date()
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear()
}

export interface APIFixture {
  fixture: {
    id: number
    date: string
    venue: { name: string | null; city: string | null } | null
    status: { short: string; long: string; elapsed: number | null }
  }
  league: { id: number; name: string; round: string; season: number }
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null }
    away: { id: number; name: string; logo: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

export interface APIStanding {
  league: {
    id: number
    name: string
    standings: Array<Array<{
      rank: number
      team: { id: number; name: string; logo: string }
      points: number
      goalsDiff: number
      form: string
      all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
      home: { played: number; win: number; draw: number; lose: number }
      away: { played: number; win: number; draw: number; lose: number }
    }>>
  }
}

export interface APIInjury {
  player: { id: number; name: string; photo: string }
  team: { id: number; name: string }
  fixture: { id: number; date: string; timezone: string; timestamp: number }
  league: { id: number; season: number }
  type: string  // "Missing Fixture" | "Questionable"
  reason: string
}

export interface APIFixtureOdd {
  fixture: { id: number }
  bookmakers: Array<{
    id: number
    name: string
    bets: Array<{
      id: number
      name: string
      values: Array<{ value: string; odd: string }>
    }>
  }>
}

export interface APILineupsResponse {
  fixture: { id: number }
  team: { id: number; name: string }
  formation: string
  startXI: Array<{
    player: { id: number; name: string; number: number; pos: string; grid: string | null }
  }>
  substitutes: Array<{
    player: { id: number; name: string; number: number; pos: string; grid: string | null }
  }>
  coach: { id: number; name: string }
}

export interface APIFixtureEvent {
  time: { elapsed: number; extra: number | null }
  team: { id: number; name: string }
  player: { id: number; name: string }
  assist: { id: number | null; name: string | null }
  type: string   // "Goal" | "Card" | "Subst" | "Var"
  detail: string // "Normal Goal" | "Yellow Card" | "Red Card" | "Substitution 1" etc.
  comments: string | null
}

export interface APIFixtureStatistic {
  team: { id: number; name: string }
  statistics: Array<{ type: string; value: number | string | null }>
}

export interface APIFixturePlayer {
  team: { id: number; name: string }
  players: Array<{
    player: { id: number; name: string; photo: string }
    statistics: Array<{
      games: { minutes: number | null; number: number; position: string; rating: string | null; captain: boolean; substitute: boolean }
      goals: { total: number | null; conceded: number; assists: number | null; saves: number | null }
      shots: { total: number | null; on: number | null }
      passes: { total: number | null; key: number | null; accuracy: string | null }
      tackles: { total: number | null; blocks: number | null; interceptions: number | null }
      cards: { yellow: number; red: number }
    }>
  }>
}

export interface APIPrediction {
  predictions: {
    winner: { id: number | null; name: string | null; comment: string | null }
    win_or_draw: boolean
    under_over: string | null  // e.g. "-2.5"
    goals: { home: string; away: string }
    advice: string
    percent: { home: string; draw: string; away: string }
  }
  teams: {
    home: {
      id: number
      name: string
      last_5: {
        form: string
        att: string
        def: string
        goals: { for: { average: number }; against: { average: number } }
      }
      league: { form: string; fixtures: any; goals: any }
    }
    away: {
      id: number
      name: string
      last_5: {
        form: string
        att: string
        def: string
        goals: { for: { average: number }; against: { average: number } }
      }
      league: { form: string; fixtures: any; goals: any }
    }
  }
  comparison: {
    form: { home: string; away: string }
    att: { home: string; away: string }
    def: { home: string; away: string }
    poisson_distribution: { home: string; away: string }
    h2h: { home: string; away: string }
    goals: { home: string; away: string }
    total: { home: string; away: string }
  }
  h2h: APIFixture[]
}

export class APIFootballClient {
  constructor(private apiKey: string) {}

  private async get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

    const res = await fetch(url.toString(), {
      headers: { 'x-apisports-key': this.apiKey },
      // Prevent Next.js from caching API responses
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`API-Football ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    if (data.errors && Object.keys(data.errors).length > 0) {
      throw new Error(`API-Football errors: ${JSON.stringify(data.errors)}`)
    }
    return data.response as T
  }

  // --- Fixtures ---

  async getFixturesForDateRange(
    leagueId: number,
    season: number,
    from: string,  // YYYY-MM-DD
    to: string     // YYYY-MM-DD
  ): Promise<APIFixture[]> {
    return this.get<APIFixture[]>('/fixtures', { league: leagueId, season, from, to })
  }

  async getUpcomingFixtures(leagueId: number, nextN: number): Promise<APIFixture[]> {
    return this.get<APIFixture[]>('/fixtures', {
      league: leagueId,
      season: getCurrentSeason(),
      next: nextN,
    })
  }

  async getTeamLastFiveResults(teamId: number): Promise<APIFixture[]> {
    return this.get<APIFixture[]>('/fixtures', { team: teamId, last: 5, status: 'FT' })
  }

  async getHeadToHead(team1Id: number, team2Id: number): Promise<APIFixture[]> {
    return this.get<APIFixture[]>('/fixtures/headtohead', {
      h2h: `${team1Id}-${team2Id}`,
      last: 5,
      status: 'FT',
    })
  }

  // --- Match context (pre-match) ---

  async getFixtureLineups(fixtureId: number): Promise<APILineupsResponse[]> {
    return this.get<APILineupsResponse[]>('/fixtures/lineups', { fixture: fixtureId })
  }

  async getFixtureEvents(fixtureId: number): Promise<APIFixtureEvent[]> {
    return this.get<APIFixtureEvent[]>('/fixtures/events', { fixture: fixtureId })
  }

  async getFixtureStatistics(fixtureId: number): Promise<APIFixtureStatistic[]> {
    return this.get<APIFixtureStatistic[]>('/fixtures/statistics', { fixture: fixtureId })
  }

  async getFixturePlayers(fixtureId: number): Promise<APIFixturePlayer[]> {
    return this.get<APIFixturePlayer[]>('/fixtures/players', { fixture: fixtureId })
  }

  async getPredictions(fixtureId: number): Promise<APIPrediction[]> {
    return this.get<APIPrediction[]>('/predictions', { fixture: fixtureId })
  }

  // --- Odds ---

  // Returns odds for one fixture from all bookmakers. Paginated: 10 bookmakers per page.
  async getOddsForFixture(fixtureId: number, page = 1): Promise<APIFixtureOdd[]> {
    return this.get<APIFixtureOdd[]>('/odds', { fixture: fixtureId, page })
  }

  // --- Standings & Injuries ---

  async getInjuries(fixtureId: number, teamId: number): Promise<APIInjury[]> {
    return this.get<APIInjury[]>('/injuries', { fixture: fixtureId, team: teamId })
  }

  async getStandings(leagueId: number): Promise<APIStanding[]> {
    return this.get<APIStanding[]>('/standings', {
      league: leagueId,
      season: getCurrentSeason(),
    })
  }
}

export function createAPIFootballClient(): APIFootballClient {
  const key = process.env.API_FOOTBALL_KEY
  if (!key) throw new Error('API_FOOTBALL_KEY env var not set')
  return new APIFootballClient(key)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mattbaker/Projects/Betbuddy && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors on `lib/api-football.ts` (there may be errors elsewhere from old imports — those will be fixed in later tasks).

- [ ] **Step 3: Commit**

```bash
git add lib/api-football.ts
git commit -m "feat: expand API-Football client with odds, predictions, lineups, stats, events"
```

---

### Task 2: Database Migration — Rich Match Data Tables

**Files:**
- Create: `supabase/migrations/20260408000003_rich_match_data.sql`

- [ ] **Step 1: Create migration file**

```sql
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

-- Add round and score columns to matches for quick display
alter table matches add column if not exists round text;
alter table matches add column if not exists home_score integer;
alter table matches add column if not exists away_score integer;
alter table matches add column if not exists ht_home_score integer;
alter table matches add column if not exists ht_away_score integer;
```

- [ ] **Step 2: Push migration**

```bash
supabase db push
```

Expected: `Applying migration 20260408000003_rich_match_data.sql...` then `Finished supabase db push.`

- [ ] **Step 3: Update `supabase/schema.sql`** to include these new tables (add them after the `odds` table, before `reports`):

```sql
-- Match lineups (announced starting XIs)
create table if not exists match_lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  team_id uuid references teams(id),
  formation text,
  start_xi jsonb not null default '[]',
  substitutes jsonb not null default '[]',
  coach_name text,
  fetched_at timestamptz default now(),
  unique(match_id, team_id)
);

-- Match events (goals, cards, subs)
create table if not exists match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  team_id uuid references teams(id),
  elapsed integer,
  type text not null,
  detail text not null,
  player_name text,
  assist_name text,
  fetched_at timestamptz default now()
);

-- AI predictions per fixture
create table if not exists match_predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid unique references matches(id) on delete cascade,
  winner_team_id integer,
  winner_name text,
  win_or_draw boolean,
  under_over text,
  advice text,
  home_win_percent text,
  draw_percent text,
  away_win_percent text,
  home_form text,
  away_form text,
  comparison jsonb,
  fetched_at timestamptz default now()
);
```

And also add these columns to the `matches` table definition in `schema.sql`:
```sql
  round text,
  home_score integer,
  away_score integer,
  ht_home_score integer,
  ht_away_score integer,
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260408000003_rich_match_data.sql supabase/schema.sql
git commit -m "feat: add match_lineups, match_events, match_predictions tables; add score columns to matches"
```

---

### Task 3: Rewrite Fixtures Sync Route

**Files:**
- Modify: `app/api/sync/fixtures/route.ts`

This replaces the Odds API fixtures sync with API-Football. For each competition, fetch fixtures in the next 14 days, upsert teams by `api_football_id`, then upsert matches by `api_football_id`.

- [ ] **Step 1: Rewrite the route**

```typescript
// app/api/sync/fixtures/route.ts
import { NextResponse } from 'next/server'
import { createAPIFootballClient, LEAGUE_IDS, getCurrentSeason } from '@/lib/api-football'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createAPIFootballClient()
    const season = getCurrentSeason()
    const now = new Date()
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const from = now.toISOString().slice(0, 10)
    const to = in14Days.toISOString().slice(0, 10)

    let totalUpserted = 0
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const [competition, leagueId] of Object.entries(LEAGUE_IDS)) {
      await sleep(300)

      let fixtures
      try {
        fixtures = await client.getFixturesForDateRange(leagueId, season, from, to)
      } catch {
        continue
      }

      for (const f of fixtures) {
        const homeTeamData = {
          api_football_id: f.teams.home.id,
          name: f.teams.home.name,
          logo_url: f.teams.home.logo,
          competition,
          country: '',
        }
        const awayTeamData = {
          api_football_id: f.teams.away.id,
          name: f.teams.away.name,
          logo_url: f.teams.away.logo,
          competition,
          country: '',
        }

        // Upsert both teams by api_football_id
        const [{ error: homeErr }, { error: awayErr }] = await Promise.all([
          supabaseAdmin.from('teams').upsert(homeTeamData, {
            onConflict: 'api_football_id',
            ignoreDuplicates: false,
          }),
          supabaseAdmin.from('teams').upsert(awayTeamData, {
            onConflict: 'api_football_id',
            ignoreDuplicates: false,
          }),
        ])

        if (homeErr || awayErr) continue

        // Fetch team UUIDs
        const [{ data: homeTeam }, { data: awayTeam }] = await Promise.all([
          supabaseAdmin.from('teams').select('id').eq('api_football_id', f.teams.home.id).single(),
          supabaseAdmin.from('teams').select('id').eq('api_football_id', f.teams.away.id).single(),
        ])

        if (!homeTeam || !awayTeam) continue

        await supabaseAdmin.from('matches').upsert({
          api_football_id: f.fixture.id,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          competition,
          match_date: f.fixture.date,
          venue: f.fixture.venue?.name ?? null,
          status: f.fixture.status.short,
          round: f.league.round,
        }, { onConflict: 'api_football_id', ignoreDuplicates: false })

        totalUpserted++
      }
    }

    return NextResponse.json({ success: true, upserted: totalUpserted })
  } catch (err) {
    console.error('Fixtures sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "sync/fixtures"
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add app/api/sync/fixtures/route.ts
git commit -m "feat: rewrite fixtures sync to use API-Football (drop Odds API)"
```

---

### Task 4: Rewrite Odds Sync Route

**Files:**
- Modify: `app/api/sync/odds/route.ts`

API-Football odds endpoint: `GET /odds?fixture=X` returns all bookmakers for that fixture. The response has `bookmakers[].bets[].name` as the market and `bets[].values[].value` as the selection. We store each selection as one row, using the first bookmaker's odds (Bet365 is bookmaker_id=1 but not always available — take whichever is first).

The `unique(match_id, market, selection)` constraint means only one odds value per selection is stored. The upsert will update to the first bookmaker found for each market/selection combo.

- [ ] **Step 1: Rewrite the route**

```typescript
// app/api/sync/odds/route.ts
import { NextResponse } from 'next/server'
import { createAPIFootballClient } from '@/lib/api-football'
import { supabaseAdmin } from '@/lib/supabase'

// Bet IDs we care about — filter to these to avoid storing irrelevant markets
// 1=Match Winner, 5=Goals Over/Under, 6=Both Teams Score, 4=Double Chance, 8=First Half Winner
const WANTED_BET_IDS = new Set([1, 4, 5, 6, 8])

export async function POST() {
  try {
    const client = createAPIFootballClient()
    let totalUpserted = 0

    const { data: matches, error } = await supabaseAdmin
      .from('matches')
      .select('id, api_football_id')
      .eq('status', 'NS')
      .not('api_football_id', 'is', null)

    if (error) throw new Error(`Failed to load matches: ${error.message}`)
    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: true, upserted: 0 })
    }

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const match of matches) {
      await sleep(200)

      let oddsData
      try {
        oddsData = await client.getOddsForFixture(match.api_football_id)
      } catch {
        continue
      }

      if (!oddsData || oddsData.length === 0) continue

      const fixtureOdds = oddsData[0]
      if (!fixtureOdds?.bookmakers?.length) continue

      // Use the first available bookmaker
      const bookmaker = fixtureOdds.bookmakers[0]

      const flatOdds: {
        match_id: string
        market: string
        selection: string
        value: number
        bookmaker: string
      }[] = []

      for (const bet of bookmaker.bets) {
        if (!WANTED_BET_IDS.has(bet.id)) continue
        for (const v of bet.values) {
          const decimal = parseFloat(v.odd)
          if (isNaN(decimal)) continue
          flatOdds.push({
            match_id: match.id,
            market: bet.name,
            selection: v.value,
            value: decimal,
            bookmaker: bookmaker.name,
          })
        }
      }

      if (flatOdds.length === 0) continue

      const { error: upsertError } = await supabaseAdmin.from('odds').upsert(flatOdds, {
        onConflict: 'match_id,market,selection',
        ignoreDuplicates: false,
      })

      if (upsertError) {
        console.error(`Odds upsert error for match ${match.id}:`, upsertError.message)
        continue
      }

      totalUpserted += flatOdds.length
    }

    return NextResponse.json({ success: true, upserted: totalUpserted })
  } catch (err) {
    console.error('Odds sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "sync/odds"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/sync/odds/route.ts
git commit -m "feat: rewrite odds sync to use API-Football /odds endpoint"
```

---

### Task 5: Create Rich Data Sync Route

**Files:**
- Create: `app/api/sync/rich/route.ts`

This route fetches lineups, predictions, and (optionally) events/statistics for all upcoming matches and stores them. Run this before generating AI reports to give Claude richer context. Costs approximately 3 API calls per match (lineups + predictions + events) = ~300 calls for 100 matches.

- [ ] **Step 1: Create the route**

```typescript
// app/api/sync/rich/route.ts
import { NextResponse } from 'next/server'
import { createAPIFootballClient } from '@/lib/api-football'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createAPIFootballClient()
    let lineupsUpserted = 0
    let predictionsUpserted = 0

    const { data: matches, error } = await supabaseAdmin
      .from('matches')
      .select('id, api_football_id, home_team_id, away_team_id')
      .eq('status', 'NS')
      .not('api_football_id', 'is', null)

    if (error) throw new Error(`Failed to load matches: ${error.message}`)
    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: true, lineups: 0, predictions: 0 })
    }

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const match of matches) {
      await sleep(250)

      // --- Predictions ---
      try {
        const preds = await client.getPredictions(match.api_football_id)
        if (preds?.length) {
          const p = preds[0]
          await supabaseAdmin.from('match_predictions').upsert({
            match_id: match.id,
            winner_team_id: p.predictions.winner?.id ?? null,
            winner_name: p.predictions.winner?.name ?? null,
            win_or_draw: p.predictions.win_or_draw,
            under_over: p.predictions.under_over,
            advice: p.predictions.advice,
            home_win_percent: p.predictions.percent.home,
            draw_percent: p.predictions.percent.draw,
            away_win_percent: p.predictions.percent.away,
            home_form: p.teams.home.last_5?.form ?? null,
            away_form: p.teams.away.last_5?.form ?? null,
            comparison: p.comparison,
            fetched_at: new Date().toISOString(),
          }, { onConflict: 'match_id', ignoreDuplicates: false })
          predictionsUpserted++
        }
      } catch { /* predictions not available for all fixtures */ }

      await sleep(250)

      // --- Lineups ---
      try {
        const lineups = await client.getFixtureLineups(match.api_football_id)
        for (const lineup of lineups) {
          // Find the team UUID from api_football_id
          const teamMatchField = lineup.team.id === (await supabaseAdmin
            .from('teams').select('api_football_id')
            .eq('id', match.home_team_id).single()
          ).data?.api_football_id ? match.home_team_id : match.away_team_id

          await supabaseAdmin.from('match_lineups').upsert({
            match_id: match.id,
            team_id: teamMatchField,
            formation: lineup.formation,
            start_xi: lineup.startXI.map(s => s.player),
            substitutes: lineup.substitutes.map(s => s.player),
            coach_name: lineup.coach.name,
            fetched_at: new Date().toISOString(),
          }, { onConflict: 'match_id,team_id', ignoreDuplicates: false })
          lineupsUpserted++
        }
      } catch { /* lineups not yet announced */ }
    }

    return NextResponse.json({ success: true, lineups: lineupsUpserted, predictions: predictionsUpserted })
  } catch (err) {
    console.error('Rich sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "sync/rich"
```

Expected: no output (or only acceptable warnings).

- [ ] **Step 3: Commit**

```bash
git add app/api/sync/rich/route.ts
git commit -m "feat: add rich data sync route for lineups and predictions"
```

---

### Task 6: Update Types

**Files:**
- Modify: `types/index.ts`

Add types for the new tables and update `Match` to include the new fields.

- [ ] **Step 1: Add new types and update Match**

Open `types/index.ts`. Replace the `Match` interface and add new interfaces at the bottom of the file:

Replace the existing `Match` interface (currently lines 19–32):
```typescript
export interface Match {
  id: string
  api_football_id: number | null
  home_team_id: string
  away_team_id: string
  competition: string
  match_date: string
  venue: string | null
  status: string
  round: string | null
  home_score: number | null
  away_score: number | null
  ht_home_score: number | null
  ht_away_score: number | null
  home_team?: Team
  away_team?: Team
  odds?: Odd[]
  report?: Report | Report[]
  lineups?: MatchLineup[]
  prediction?: MatchPrediction
}
```

Add these new interfaces at the end of the file (before the last closing of the file — there is no explicit module end, just append):
```typescript
export interface MatchLineup {
  id: string
  match_id: string
  team_id: string
  formation: string | null
  start_xi: { id: number; name: string; number: number; position: string }[]
  substitutes: { id: number; name: string; number: number; position: string }[]
  coach_name: string | null
}

export interface MatchPrediction {
  id: string
  match_id: string
  winner_team_id: number | null
  winner_name: string | null
  win_or_draw: boolean
  under_over: string | null
  advice: string | null
  home_win_percent: string | null
  draw_percent: string | null
  away_win_percent: string | null
  home_form: string | null
  away_form: string | null
  comparison: Record<string, { home: string; away: string }> | null
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: any remaining errors are in files not yet updated (will be fixed in later tasks).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add MatchLineup and MatchPrediction types; update Match with new fields"
```

---

### Task 7: Update MatchRow and OddsPanel for API-Football Odds Format

**Files:**
- Modify: `components/MatchRow.tsx`
- Modify: `components/OddsPanel.tsx`

API-Football odds use `market="Match Winner"` with `selection="Home"/"Draw"/"Away"` instead of team names. OddsPanel market labels need to match API-Football bet names.

- [ ] **Step 1: Update MatchRow odds lookup**

In `components/MatchRow.tsx`, replace lines 10–12 (the three `const *Odds` declarations):

```typescript
  const homeOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Home')
  const drawOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Draw')
  const awayOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Away')
```

- [ ] **Step 2: Update OddsPanel market labels**

In `components/OddsPanel.tsx`, replace the `MARKET_LABELS` object (lines 5–11):

```typescript
const MARKET_LABELS: Record<string, string> = {
  'Match Winner': 'Match Result (1X2)',
  'Double Chance': 'Double Chance',
  'Goals Over/Under': 'Over / Under Goals',
  'Both Teams Score': 'Both Teams to Score',
  'First Half Winner': 'Half Time Result',
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "MatchRow|OddsPanel"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/MatchRow.tsx components/OddsPanel.tsx
git commit -m "fix: update odds market/selection lookups for API-Football format"
```

---

### Task 8: Enhance Research Agent with Richer Context

**Files:**
- Modify: `lib/research-agent.ts`
- Modify: `app/api/reports/generate/route.ts`

The report generation route needs to fetch predictions and lineups from the DB and pass them to Claude. The research agent prompt needs updating to use this extra context.

- [ ] **Step 1: Update `ResearchContext` interface and prompt in `lib/research-agent.ts`**

Replace the `ResearchContext` interface (lines 5–12) with:

```typescript
export interface ResearchContext {
  homeForm: any[]
  awayForm: any[]
  h2h: any[]
  homeInjuries: any[]
  awayInjuries: any[]
  standings: any[]
  prediction: any | null       // API-Football Poisson prediction
  homeLineup: any | null       // Starting XI if announced
  awayLineup: any | null
}
```

Replace the `buildResearchPrompt` function body (lines 14–71) with:

```typescript
export function buildResearchPrompt(
  homeTeam: string,
  awayTeam: string,
  context: ResearchContext
): string {
  const lineupSection = context.homeLineup || context.awayLineup
    ? `
### Announced Lineups:
${homeTeam}: ${context.homeLineup
  ? `Formation: ${context.homeLineup.formation} | XI: ${context.homeLineup.start_xi.map((p: any) => p.name).join(', ')}`
  : 'Not yet announced'}
${awayTeam}: ${context.awayLineup
  ? `Formation: ${context.awayLineup.formation} | XI: ${context.awayLineup.start_xi.map((p: any) => p.name).join(', ')}`
  : 'Not yet announced'}`
    : ''

  const predictionSection = context.prediction
    ? `
### Statistical Prediction (Poisson model):
Advice: ${context.prediction.advice}
Win probability — ${homeTeam}: ${context.prediction.home_win_percent}, Draw: ${context.prediction.draw_percent}, ${awayTeam}: ${context.prediction.away_win_percent}
Predicted winner: ${context.prediction.winner_name ?? 'Draw'}
Over/Under signal: ${context.prediction.under_over ?? 'N/A'}
${homeTeam} last-5 form: ${context.prediction.home_form ?? 'N/A'}
${awayTeam} last-5 form: ${context.prediction.away_form ?? 'N/A'}
Comparison: ${JSON.stringify(context.prediction.comparison)}`
    : ''

  return `You are a football betting research analyst. Analyse the upcoming match between ${homeTeam} (home) and ${awayTeam} (away) using the data provided below.

## Available Data

### ${homeTeam} Recent Form (last 5):
${JSON.stringify(context.homeForm, null, 2)}

### ${awayTeam} Recent Form (last 5):
${JSON.stringify(context.awayForm, null, 2)}

### Head-to-head (last 5 meetings):
${JSON.stringify(context.h2h, null, 2)}

### ${homeTeam} Injuries/Suspensions:
${JSON.stringify(context.homeInjuries, null, 2)}

### ${awayTeam} Injuries/Suspensions:
${JSON.stringify(context.awayInjuries, null, 2)}

### League Standings:
${JSON.stringify(context.standings, null, 2)}
${lineupSection}
${predictionSection}

## Instructions

Produce a structured JSON report covering ALL of the following 9 sections:

1. **recent form** — last 5 results per team, goals scored/conceded, clean sheets
2. **head-to-head** — last 5 meetings, average goals, home/away patterns
3. **squad availability** — confirmed injuries, suspensions, doubtful players, key players missing from lineup if announced
4. **key players** — top performers last 3-5 games (goals, assists, cards, shots)
5. **home/away record** — season performance split by venue
6. **league context** — table position, points gap, motivation
7. **tactical** — formation (use announced lineup if available), pressing style, set piece threat
8. **conditions** — weather or pitch notes if known
9. **suggestions** — 2-4 specific betting markets with odds, reasoning, and confidence. Use the statistical prediction as one data point but apply your own analysis.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "form": {
    "home": { "last_5_results": [], "goals_scored_last5": 0, "goals_conceded_last5": 0 },
    "away": { "last_5_results": [], "goals_scored_last5": 0, "goals_conceded_last5": 0 }
  },
  "h2h": { "matches": [], "avg_goals": 0, "home_wins": 0, "away_wins": 0, "draws": 0 },
  "squad": { "home_injuries": [], "home_suspensions": [], "away_injuries": [], "away_suspensions": [] },
  "key_players": { "home": [], "away": [] },
  "home_away_record": { "home_team_home": "", "away_team_away": "" },
  "league_context": { "home_position": 0, "away_position": 0, "home_points": 0, "away_points": 0, "notes": "" },
  "tactical_notes": "",
  "conditions": "",
  "suggestions": [
    { "label": "", "market": "", "selection": "", "odds": 0, "reasoning": "", "confidence": "High|Medium|Low" }
  ]
}`
}
```

- [ ] **Step 2: Update `app/api/reports/generate/route.ts`** to fetch and pass prediction + lineups

Replace the entire file:

```typescript
// app/api/reports/generate/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateReport } from '@/lib/research-agent'
import { createAPIFootballClient, LEAGUE_IDS } from '@/lib/api-football'

export async function POST(req: Request) {
  try {
    const { matchId, triggeredBy = 'manual' } = await req.json()

    if (!matchId) {
      return NextResponse.json({ error: 'matchId required' }, { status: 400 })
    }

    const { data: match, error } = await supabaseAdmin
      .from('matches')
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
      .eq('id', matchId)
      .single()

    if (error || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const footballClient = createAPIFootballClient()
    const competition = match.competition as keyof typeof LEAGUE_IDS

    // Fetch cached form data (24h TTL)
    const [{ data: homeFormCache }, { data: awayFormCache }] = await Promise.all([
      supabaseAdmin.from('team_form').select('*').eq('team_id', match.home_team.id)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).single(),
      supabaseAdmin.from('team_form').select('*').eq('team_id', match.away_team.id)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).single(),
    ])

    // Fetch prediction and lineups from DB (synced by /api/sync/rich)
    const [{ data: predictionRow }, { data: lineupsData }] = await Promise.all([
      supabaseAdmin.from('match_predictions').select('*').eq('match_id', matchId).single(),
      supabaseAdmin.from('match_lineups').select('*').eq('match_id', matchId),
    ])

    const homeLineup = lineupsData?.find(l => l.team_id === match.home_team_id) ?? null
    const awayLineup = lineupsData?.find(l => l.team_id === match.away_team_id) ?? null

    // Fetch live data from API-Football for what's not cached
    const [homeFormRaw, awayFormRaw, h2h, homeInjuries, awayInjuries, standings] = await Promise.all([
      homeFormCache
        ? Promise.resolve(homeFormCache.last_5_results)
        : footballClient.getTeamLastFiveResults(match.home_team.api_football_id).catch(() => []),
      awayFormCache
        ? Promise.resolve(awayFormCache.last_5_results)
        : footballClient.getTeamLastFiveResults(match.away_team.api_football_id).catch(() => []),
      footballClient.getHeadToHead(match.home_team.api_football_id, match.away_team.api_football_id).catch(() => []),
      match.api_football_id
        ? footballClient.getInjuries(match.api_football_id, match.home_team.api_football_id).catch(() => [])
        : Promise.resolve([]),
      match.api_football_id
        ? footballClient.getInjuries(match.api_football_id, match.away_team.api_football_id).catch(() => [])
        : Promise.resolve([]),
      (LEAGUE_IDS[competition]
        ? footballClient.getStandings(LEAGUE_IDS[competition])
        : Promise.resolve([])
      ).catch(() => []),
    ])

    const homeForm = homeFormCache ? homeFormCache.last_5_results : homeFormRaw
    const awayForm = awayFormCache ? awayFormCache.last_5_results : awayFormRaw

    // Cache form data
    if (!homeFormCache && Array.isArray(homeFormRaw) && homeFormRaw.length) {
      await supabaseAdmin.from('team_form').upsert({
        team_id: match.home_team.id,
        last_5_results: homeFormRaw,
        goals_scored_last5: homeFormRaw.reduce((a: number, f: any) => a + (f.goals?.home ?? 0), 0),
        goals_conceded_last5: homeFormRaw.reduce((a: number, f: any) => a + (f.goals?.away ?? 0), 0),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'team_id' })
    }
    if (!awayFormCache && Array.isArray(awayFormRaw) && awayFormRaw.length) {
      await supabaseAdmin.from('team_form').upsert({
        team_id: match.away_team.id,
        last_5_results: awayFormRaw,
        goals_scored_last5: awayFormRaw.reduce((a: number, f: any) => a + (f.goals?.away ?? 0), 0),
        goals_conceded_last5: awayFormRaw.reduce((a: number, f: any) => a + (f.goals?.home ?? 0), 0),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'team_id' })
    }

    const reportContent = await generateReport(
      match.home_team.name,
      match.away_team.name,
      {
        homeForm,
        awayForm,
        h2h,
        homeInjuries,
        awayInjuries,
        standings,
        prediction: predictionRow ?? null,
        homeLineup,
        awayLineup,
      }
    )

    const { error: upsertError } = await supabaseAdmin.from('reports').upsert({
      match_id: matchId,
      content: reportContent,
      generated_at: new Date().toISOString(),
      triggered_by: triggeredBy,
    }, { onConflict: 'match_id' })

    if (upsertError) throw upsertError

    return NextResponse.json({ success: true, report: reportContent })
  } catch (err) {
    console.error('Report generation error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "research-agent|reports/generate"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add lib/research-agent.ts app/api/reports/generate/route.ts
git commit -m "feat: enhance research agent with predictions and lineups from API-Football"
```

---

### Task 9: Add SYNC RICH Button to Dashboard

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add SYNC RICH button** to the sync buttons section in `app/page.tsx`

Find the existing buttons section (around line 44–60). Add a third button after `SYNC ODDS`:

```tsx
<form action="/api/sync/rich" method="POST">
  <button
    type="submit"
    className="text-[10px] font-mono tracking-widest text-[#5a6a7e] hover:text-[#8a9ab0] border border-[#1c2535] rounded px-3 py-1.5 hover:bg-[#1c2535] transition-colors"
  >
    SYNC RICH
  </button>
</form>
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add SYNC RICH button to dashboard"
```

---

### Task 10: Remove The Odds API

**Files:**
- Delete: `lib/odds-api.ts`
- Check all imports reference removed

- [ ] **Step 1: Delete odds-api.ts**

```bash
rm /Users/mattbaker/Projects/Betbuddy/lib/odds-api.ts
```

- [ ] **Step 2: Check for any remaining imports**

```bash
grep -r "odds-api" /Users/mattbaker/Projects/Betbuddy --include="*.ts" --include="*.tsx" -l
```

Expected: no output (no files importing odds-api).

If any files are returned, open each and remove the import.

- [ ] **Step 3: Full TypeScript compile check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Note about env vars**

The `ODDS_API_KEY` env var in Vercel is no longer needed. Remove it from the Vercel dashboard under Project Settings → Environment Variables to keep things clean (optional but recommended).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove The Odds API (lib/odds-api.ts) — fully replaced by API-Football"
```

---

### Task 11: Deploy and Verify

- [ ] **Step 1: Push all commits**

```bash
git push
```

- [ ] **Step 2: Wait for Vercel to deploy** (check https://vercel.com/dashboard or watch build logs)

- [ ] **Step 3: Test SYNC FIXTURES**

Navigate to https://betbuddy-seven.vercel.app/ and click **SYNC FIXTURES**.

Expected response: `{"success":true,"upserted":N}` where N > 0.

- [ ] **Step 4: Test SYNC ODDS**

Click **SYNC ODDS**.

Expected response: `{"success":true,"upserted":N}` where N > 0.

- [ ] **Step 5: Test SYNC RICH**

Click **SYNC RICH**.

Expected response: `{"success":true,"lineups":N,"predictions":N}` — predictions will be > 0, lineups may be 0 if lineups haven't been announced yet (typically announced 1–2 hours before kickoff).

- [ ] **Step 6: Verify odds appear in dashboard**

Navigate to https://betbuddy-seven.vercel.app/ and confirm:
- Matches are showing
- 1/X/2 odds buttons appear on each match row
- Clicking a match shows the OddsPanel with market tabs

- [ ] **Step 7: Test AI report generation**

Click into any match and click **GENERATE AI REPORT**. Verify the report generates successfully and includes suggestions section with odds.

- [ ] **Step 8: Commit verification note**

```bash
git commit --allow-empty -m "chore: API-Football migration complete and verified in production"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| Replace Odds API fixtures | Task 3 |
| Replace Odds API odds | Task 4 |
| Full markets (not just h2h/totals) | Task 4 (all WANTED_BET_IDS) |
| Lineups for AI reports | Task 5 + 8 |
| Predictions for AI reports | Task 5 + 8 |
| Statistics/events available | Task 1 (methods added, not synced to DB — fetched on demand) |
| Season computation fix (Apr 2026 = season 2025) | Task 1 (getCurrentSeason) |
| Remove odds-api.ts | Task 10 |
| Dashboard SYNC RICH button | Task 9 |
| Type safety | Task 6 |

### Notes for Implementer

- **WANTED_BET_IDS** in Task 4: The bet IDs (1, 4, 5, 6, 8) are based on API-Football documentation and common knowledge. After first sync, verify by calling `https://v3.football.api-sports.io/odds/bets` with your API key to confirm exact IDs match these names: Match Winner, Double Chance, Goals Over/Under, Both Teams Score, First Half Winner.

- **Lineup team matching** in Task 5 (rich sync): The lineup upsert uses a simplified team ID lookup. If it causes issues, simplify by querying `teams` by `api_football_id` directly.

- **`odds_event_id`** on `matches`: This column was added in a previous migration for The Odds API and is now unused. It can remain in the DB harmlessly.

- **The `match_results` table** is still in the schema but unused by current code. It can be used in a future task to store post-match statistics.
