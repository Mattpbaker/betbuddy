// __tests__/lib/odds-api.test.ts
import { OddsAPIClient, ODDS_SPORT_KEYS } from '@/lib/odds-api'

const mockFetch = jest.fn()

describe('OddsAPIClient', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    mockFetch.mockReset()
  })
  afterEach(() => jest.restoreAllMocks())

  it('fetches odds for a sport and returns structured data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{
        id: 'abc123',
        sport_key: 'soccer_england_league1',
        commence_time: '2026-04-10T19:45:00Z',
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        bookmakers: [{
          key: 'bet365',
          markets: [{
            key: 'h2h',
            outcomes: [
              { name: 'Arsenal', price: 1.85 },
              { name: 'Chelsea', price: 4.10 },
              { name: 'Draw', price: 3.20 },
            ],
          }],
        }],
      }]),
    })

    const client = new OddsAPIClient('test-key')
    const odds = await client.getOdds('soccer_england_league1', ['h2h'])

    expect(odds).toHaveLength(1)
    expect(odds[0].home_team).toBe('Arsenal')
    expect(odds[0].bookmakers[0].markets[0].outcomes).toHaveLength(3)
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized' })

    const client = new OddsAPIClient('bad-key')
    await expect(client.getOdds('soccer_england_league1', ['h2h'])).rejects.toThrow('Odds API error: 401')
  })

  it('flattenOdds returns one entry per outcome', () => {
    const client = new OddsAPIClient('test-key')
    const event = {
      id: 'abc123',
      sport_key: 'soccer_england_premier_league',
      commence_time: '2026-04-10T19:45:00Z',
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      bookmakers: [{
        key: 'bet365',
        markets: [{
          key: 'h2h',
          outcomes: [
            { name: 'Arsenal', price: 1.85 },
            { name: 'Chelsea', price: 4.10 },
            { name: 'Draw', price: 3.20 },
          ],
        }],
      }],
    }
    const flattened = client.flattenOdds(event, 'match-uuid-1')
    expect(flattened).toHaveLength(3)
    expect(flattened[0]).toMatchObject({
      match_id: 'match-uuid-1',
      market: 'h2h',
      selection: 'Arsenal',
      value: 1.85,
      bookmaker: 'bet365',
    })
  })

  it('flattenOdds includes point in selection name for totals market', () => {
    const client = new OddsAPIClient('test-key')
    const event = {
      id: 'abc123',
      sport_key: 'soccer_england_premier_league',
      commence_time: '2026-04-10T19:45:00Z',
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      bookmakers: [{
        key: 'bet365',
        markets: [{
          key: 'totals',
          outcomes: [
            { name: 'Over', price: 1.60, point: 2.5 },
            { name: 'Under', price: 2.25, point: 2.5 },
          ],
        }],
      }],
    }
    const flattened = client.flattenOdds(event, 'match-uuid-1')
    expect(flattened[0].selection).toBe('Over +2.5')
    expect(flattened[1].selection).toBe('Under +2.5')
  })
})
