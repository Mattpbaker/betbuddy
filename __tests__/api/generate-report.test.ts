// __tests__/api/generate-report.test.ts
import { POST } from '@/app/api/reports/generate/route'

// Mock Supabase admin client
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: 'match-1',
        api_football_id: 12345,
        competition: 'Premier League',
        home_team: { id: 'team-home', name: 'Arsenal', api_football_id: 42 },
        away_team: { id: 'team-away', name: 'Chelsea', api_football_id: 49 },
      },
      error: null,
    }),
    upsert: jest.fn().mockResolvedValue({ error: null }),
  }
}))

// Mock research agent
jest.mock('@/lib/research-agent', () => ({
  generateReport: jest.fn().mockResolvedValue({
    form: { home: { last_5_results: [], goals_scored_last5: 8, goals_conceded_last5: 2 }, away: { last_5_results: [], goals_scored_last5: 5, goals_conceded_last5: 5 } },
    h2h: { matches: [], avg_goals: 2.5, home_wins: 3, away_wins: 1, draws: 1 },
    squad: { home_injuries: [], home_suspensions: [], away_injuries: [], away_suspensions: [] },
    key_players: { home: [], away: [] },
    home_away_record: { home_team_home: '4W 0D 1L', away_team_away: '2W 1D 2L' },
    league_context: { home_position: 2, away_position: 4, home_points: 65, away_points: 58, notes: '' },
    tactical_notes: '',
    conditions: '',
    suggestions: [],
  }),
}))

// Mock API-Football client
jest.mock('@/lib/api-football', () => ({
  createAPIFootballClient: jest.fn().mockReturnValue({
    getTeamLastFiveResults: jest.fn().mockResolvedValue([]),
    getHeadToHead: jest.fn().mockResolvedValue([]),
    getInjuries: jest.fn().mockResolvedValue([]),
    getStandings: jest.fn().mockResolvedValue([]),
  }),
  LEAGUE_IDS: { 'Premier League': 39 },
}))

describe('POST /api/reports/generate', () => {
  it('returns 400 when matchId is missing', async () => {
    const req = new Request('http://localhost/api/reports/generate', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('generates and stores a report for a valid matchId', async () => {
    const req = new Request('http://localhost/api/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ matchId: 'match-1', triggeredBy: 'manual' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.report).toBeDefined()
  })
})
