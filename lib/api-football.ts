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
  formation: string | null
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
      league: { form: string; fixtures: Record<string, unknown>; goals: Record<string, unknown> }
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
      league: { form: string; fixtures: Record<string, unknown>; goals: Record<string, unknown> }
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
