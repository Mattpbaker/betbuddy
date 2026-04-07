// __tests__/lib/api-football.test.ts
import { APIFootballClient } from '@/lib/api-football'

const mockFetch = jest.fn()

describe('APIFootballClient', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch)
    mockFetch.mockReset()
  })
  afterEach(() => jest.restoreAllMocks())

  it('fetches upcoming fixtures for a league', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: [{
          fixture: { id: 12345, date: '2026-04-10T19:45:00Z', venue: { name: 'Emirates' }, status: { short: 'NS' } },
          league: { name: 'Premier League', round: 'Regular Season - 32' },
          teams: {
            home: { id: 42, name: 'Arsenal', logo: 'https://example.com/arsenal.png' },
            away: { id: 49, name: 'Chelsea', logo: 'https://example.com/chelsea.png' },
          },
          goals: { home: null, away: null },
          score: { halftime: { home: null, away: null } },
        }],
      }),
    })

    const client = new APIFootballClient('test-key')
    const fixtures = await client.getUpcomingFixtures(39, 7)

    expect(fixtures).toHaveLength(1)
    expect(fixtures[0].fixture.id).toBe(12345)
    expect(fixtures[0].teams.home.name).toBe('Arsenal')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/fixtures'),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-apisports-key': 'test-key' }) })
    )
  })

  it('fetches team form (last 5 results)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: [{ fixture: { id: 1, date: '2026-04-05T15:00:00Z', status: { short: 'FT' } }, teams: { home: { id: 42, winner: true }, away: { id: 50, winner: false } }, goals: { home: 2, away: 0 } }],
      }),
    })

    const client = new APIFootballClient('test-key')
    const form = await client.getTeamLastFiveResults(42)
    expect(form).toHaveLength(1)
  })

  it('fetches injuries for a team in a fixture', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: [{ player: { name: 'Reece James' }, type: 'injury' }],
      }),
    })

    const client = new APIFootballClient('test-key')
    const injuries = await client.getInjuries(12345, 49)
    expect(injuries[0].player.name).toBe('Reece James')
  })
})
