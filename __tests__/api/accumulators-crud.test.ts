// __tests__/api/accumulators-crud.test.ts
import { GET, POST } from '@/app/api/accumulators/route'

const mockAccumulators = [
  {
    id: 'accu-1',
    name: 'Weekend Double',
    total_odds: 3.23,
    ai_summary: 'A solid low-risk double.',
    created_at: '2026-04-20T10:00:00Z',
    legs: [
      {
        id: 'leg-1',
        accumulator_id: 'accu-1',
        match_id: 'match-1',
        market: 'Match Winner',
        selection: 'Home',
        odds: 1.9,
        confidence: 'High',
        report_id: null,
        match: { match_date: '2026-04-21T15:00:00Z', competition: 'Premier League', home_team: { name: 'Arsenal' }, away_team: { name: 'Chelsea' } },
      },
    ],
  },
]

const mockInsertAccu = { data: { id: 'accu-new' }, error: null }
const mockInsertLegs = { error: null }

const mockFrom = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...args: any[]) => mockFrom(...args) },
}))

describe('GET /api/accumulators', () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: mockAccumulators, error: null }),
    })
  })

  it('returns list of saved accumulators with legs', async () => {
    const req = new Request('http://localhost/api/accumulators')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accumulators).toHaveLength(1)
    expect(body.accumulators[0].name).toBe('Weekend Double')
    expect(body.accumulators[0].legs).toHaveLength(1)
  })
})

describe('POST /api/accumulators', () => {
  beforeEach(() => {
    mockFrom
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(mockInsertAccu),
      })
      .mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue(mockInsertLegs),
      })
  })

  it('returns 400 when required fields are missing', async () => {
    const req = new Request('http://localhost/api/accumulators', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('saves accumulator and legs, returns id', async () => {
    const req = new Request('http://localhost/api/accumulators', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Weekend Double',
        totalOdds: 3.23,
        aiSummary: 'Solid double.',
        legs: [
          { matchId: 'match-1', market: 'Match Winner', selection: 'Home', odds: 1.9, confidence: 'High', reportId: null },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('accu-new')
  })
})
