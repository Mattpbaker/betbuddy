// app/api/sync/odds/route.ts
import { NextResponse } from 'next/server'
import { createOddsAPIClient, ODDS_SPORT_KEYS, MARKETS } from '@/lib/odds-api'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createOddsAPIClient()
    let totalUpserted = 0

    const errors: Record<string, string> = {}
    let firstEventId: string | null = null
    let firstDbMatch: string | null = null
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const [competition, sportKey] of Object.entries(ODDS_SPORT_KEYS)) {
      await sleep(500)
      let events
      try {
        events = await client.getOdds(sportKey, MARKETS)
      } catch (err) {
        errors[competition] = String(err)
        continue
      }

      if (!firstEventId && events.length > 0) {
        firstEventId = events[0].id
        const { data: m } = await supabaseAdmin.from('matches').select('id,odds_event_id').eq('odds_event_id', events[0].id).single()
        firstDbMatch = m ? `found: ${m.id}` : 'not found'
      }

      for (const event of events) {
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

    return NextResponse.json({ success: true, upserted: totalUpserted, firstEventId, firstDbMatch, errors })
  } catch (err) {
    console.error('Odds sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
