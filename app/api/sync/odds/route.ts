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
