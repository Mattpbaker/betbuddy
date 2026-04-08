// app/api/sync/odds/route.ts
import { NextResponse } from 'next/server'
import { createOddsAPIClient, ODDS_SPORT_KEYS, MARKETS } from '@/lib/odds-api'
import { supabaseAdmin } from '@/lib/supabase'

// Reverse map: competition name → sport key
const COMPETITION_TO_SPORT_KEY = Object.fromEntries(
  Object.entries(ODDS_SPORT_KEYS).map(([comp, key]) => [comp, key])
)

export async function POST() {
  try {
    const client = createOddsAPIClient()
    let totalUpserted = 0

    // Load all scheduled matches that have an Odds API event ID
    const { data: matches, error } = await supabaseAdmin
      .from('matches')
      .select('id, odds_event_id, competition')
      .eq('status', 'scheduled')
      .not('odds_event_id', 'is', null)

    if (error) throw new Error(`Failed to load matches: ${error.message}`)
    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: true, upserted: 0, message: 'No scheduled matches with event IDs' })
    }

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const match of matches) {
      const sportKey = COMPETITION_TO_SPORT_KEY[match.competition]
      if (!sportKey) continue

      await sleep(200)

      let event
      try {
        event = await client.getEventOdds(sportKey, match.odds_event_id, MARKETS)
      } catch {
        continue
      }

      const flatOdds = client.flattenOdds(event, match.id)
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
