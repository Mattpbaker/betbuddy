// app/api/sync/odds/route.ts
import { NextResponse } from 'next/server'
import { createOddsAPIClient, ODDS_SPORT_KEYS, MARKETS } from '@/lib/odds-api'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createOddsAPIClient()
    let totalUpserted = 0

    for (const [, sportKey] of Object.entries(ODDS_SPORT_KEYS)) {
      let events
      try {
        events = await client.getOdds(sportKey, MARKETS)
      } catch {
        // Some competitions may not be available — skip gracefully
        continue
      }

      for (const event of events) {
        // Match directly by Odds API event ID (set during fixture sync)
        const { data: match } = await supabaseAdmin
          .from('matches')
          .select('id')
          .eq('odds_event_id', event.id)
          .single()

        if (!match) continue

        const flatOdds = client.flattenOdds(event, match.id)

        await supabaseAdmin.from('odds').upsert(flatOdds, {
          onConflict: 'match_id,market,selection',
          ignoreDuplicates: false,
        })

        totalUpserted += flatOdds.length
      }
    }

    return NextResponse.json({ success: true, upserted: totalUpserted })
  } catch (err) {
    console.error('Odds sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
