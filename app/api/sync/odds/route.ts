// app/api/sync/odds/route.ts
import { NextResponse } from 'next/server'
import { createOddsAPIClient, ODDS_SPORT_KEYS, MARKETS } from '@/lib/odds-api'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createOddsAPIClient()
    let totalUpserted = 0

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const [competition, sportKey] of Object.entries(ODDS_SPORT_KEYS)) {
      await sleep(500)

      let events
      try {
        events = await client.getOdds(sportKey, MARKETS)
      } catch {
        continue
      }

      for (const event of events) {
        const { data: match } = await supabaseAdmin
          .from('matches')
          .select('id')
          .eq('odds_event_id', event.id)
          .single()

        if (!match) continue

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
    }

    return NextResponse.json({ success: true, upserted: totalUpserted })
  } catch (err) {
    console.error('Odds sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
