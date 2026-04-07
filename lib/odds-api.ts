// lib/odds-api.ts

const BASE_URL = 'https://api.the-odds-api.com/v4'

// Sport keys mapping for our competitions
export const ODDS_SPORT_KEYS: Record<string, string> = {
  'Premier League': 'soccer_england_premier_league',
  'La Liga': 'soccer_spain_la_liga',
  'Bundesliga': 'soccer_germany_bundesliga',
  'Serie A': 'soccer_italy_serie_a',
  'Ligue 1': 'soccer_france_ligue_one',
  'FA Cup': 'soccer_england_league_cup',
  'Copa del Rey': 'soccer_spain_segunda_division',
  'DFB-Pokal': 'soccer_germany_bundesliga2',
  'Coppa Italia': 'soccer_italy_serie_b',
  'Coupe de France': 'soccer_france_ligue_two',
  'Champions League': 'soccer_uefa_champs_league',
  'Europa League': 'soccer_uefa_europa_league',
}

// Markets we want to fetch
export const MARKETS = ['h2h', 'totals', 'btts', 'corners', 'cards']

export interface OddsEvent {
  id: string
  sport_key: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: {
    key: string
    markets: {
      key: string
      outcomes: { name: string; price: number; point?: number }[]
    }[]
  }[]
}

export interface OddsFixture {
  id: string
  sport_key: string
  commence_time: string
  home_team: string
  away_team: string
}

export class OddsAPIClient {
  constructor(private apiKey: string) {}

  // Returns upcoming fixtures for a sport — does NOT count against quota
  async getEvents(sportKey: string): Promise<OddsFixture[]> {
    const url = new URL(`${BASE_URL}/sports/${sportKey}/events`)
    url.searchParams.set('apiKey', this.apiKey)
    url.searchParams.set('dateFormat', 'iso')

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Odds API error: ${res.status} ${res.statusText}`)
    return res.json()
  }

  async getOdds(sportKey: string, markets: string[]): Promise<OddsEvent[]> {
    const url = new URL(`${BASE_URL}/sports/${sportKey}/odds`)
    url.searchParams.set('apiKey', this.apiKey)
    url.searchParams.set('regions', 'uk')
    url.searchParams.set('markets', markets.join(','))
    url.searchParams.set('oddsFormat', 'decimal')

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Odds API error: ${res.status} ${res.statusText}`)
    return res.json()
  }

  // Flatten bookmaker odds into our Odd[] format for a specific event
  flattenOdds(event: OddsEvent, matchId: string): {
    match_id: string
    market: string
    selection: string
    value: number
    bookmaker: string
  }[] {
    const results: { match_id: string; market: string; selection: string; value: number; bookmaker: string }[] = []

    for (const bookmaker of event.bookmakers) {
      for (const market of bookmaker.markets) {
        for (const outcome of market.outcomes) {
          const selection = outcome.point !== undefined
            ? `${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point}`
            : outcome.name
          results.push({
            match_id: matchId,
            market: market.key,
            selection,
            value: outcome.price,
            bookmaker: bookmaker.key,
          })
        }
      }
    }

    return results
  }
}

export function createOddsAPIClient(): OddsAPIClient {
  const key = process.env.ODDS_API_KEY
  if (!key) throw new Error('ODDS_API_KEY env var not set')
  return new OddsAPIClient(key)
}
