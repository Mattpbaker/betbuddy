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

export interface APIFixture {
  fixture: {
    id: number
    date: string
    venue: { name: string } | null
    status: { short: string }
  }
  league: { id: number; name: string; round: string }
  teams: {
    home: { id: number; name: string; logo: string }
    away: { id: number; name: string; logo: string }
  }
  goals: { home: number | null; away: number | null }
  score: { halftime: { home: number | null; away: number | null } }
}

export interface APIInjury {
  player: { id: number; name: string }
  team: { id: number }
  fixture: { id: number }
  type: string
  reason: string
}

export class APIFootballClient {
  constructor(private apiKey: string) {}

  private async get<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

    const res = await fetch(url.toString(), {
      headers: {
        'x-apisports-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) throw new Error(`API-Football error: ${res.status} ${res.statusText}`)
    const data = await res.json()
    return data.response as T
  }

  async getUpcomingFixtures(leagueId: number, nextN: number): Promise<APIFixture[]> {
    return this.get<APIFixture[]>('/fixtures', {
      league: leagueId,
      season: new Date().getFullYear(),
      next: nextN,
    })
  }

  async getTeamLastFiveResults(teamId: number): Promise<APIFixture[]> {
    return this.get<APIFixture[]>('/fixtures', {
      team: teamId,
      last: 5,
      status: 'FT',
    })
  }

  async getHeadToHead(team1Id: number, team2Id: number): Promise<APIFixture[]> {
    return this.get<APIFixture[]>('/fixtures/headtohead', {
      h2h: `${team1Id}-${team2Id}`,
      last: 5,
      status: 'FT',
    })
  }

  async getInjuries(fixtureId: number, teamId: number): Promise<APIInjury[]> {
    return this.get<APIInjury[]>('/injuries', {
      fixture: fixtureId,
      team: teamId,
    })
  }

  async getStandings(leagueId: number): Promise<any[]> {
    return this.get<any[]>('/standings', {
      league: leagueId,
      season: new Date().getFullYear(),
    })
  }
}

export function createAPIFootballClient(): APIFootballClient {
  const key = process.env.API_FOOTBALL_KEY
  if (!key) throw new Error('API_FOOTBALL_KEY env var not set')
  return new APIFootballClient(key)
}
