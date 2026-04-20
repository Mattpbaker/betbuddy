// __tests__/api/accumulators-candidates.test.ts
import { GET } from '@/app/api/accumulators/candidates/route'

const mockMatches = [
  {
    id: 'match-1',
    match_date: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    competition: 'Premier League',
    status: 'NS',
    home_team: { name: 'Arsenal' },
    away_team: { name: 'Chelsea' },
    report: [
      {
        id: 'report-1',
        content: {
          suggestions: [
            { label: 'Home Win', market: 'Match Winner', selection: 'Home', odds: 1.9, confidence: 'High', reasoning: 'Strong home form' },
            { label: 'BTTS', market: 'Both Teams Score', selection: 'Yes', odds: 1.7, confidence: 'Medium', reasoning: 'Both score often' },
          ],
        },
      },
    ],
  },
  {
    id: 'match-2',
    match_date: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    competition: 'La Liga',
    status: 'NS',
    home_team: { name: 'Barcelona' },
    away_team: { name: 'Real Madrid' },
    report: [], // no report — should be excluded
  },
]

jest.mock('@/lib/supabase', () => {
  const order = jest.fn()
  return {
    supabaseAdmin: {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order,
    },
    __order: order,
  }
})

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { __order } = require('@/lib/supabase') as { __order: jest.Mock }
  __order.mockResolvedValue({ data: mockMatches, error: null })
})

describe('GET /api/accumulators/candidates', () => {
  it('returns 400 when timeframe is invalid', async () => {
    const req = new Request('http://localhost/api/accumulators/candidates?timeframe=7')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns only candidates from matches that have reports with suggestions', async () => {
    const req = new Request('http://localhost/api/accumulators/candidates?timeframe=1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.candidates).toHaveLength(2)
    expect(body.candidates[0].matchId).toBe('match-1')
    expect(body.candidates[0].homeTeam).toBe('Arsenal')
    expect(body.candidates[0].market).toBe('Match Winner')
    expect(body.candidates[1].market).toBe('Both Teams Score')
  })

  it('defaults to timeframe=1 when not provided', async () => {
    const req = new Request('http://localhost/api/accumulators/candidates')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})
