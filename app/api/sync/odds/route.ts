// app/api/sync/odds/route.ts
import { NextResponse } from 'next/server'
import { createOddsAPIClient, ODDS_SPORT_KEYS, MARKETS } from '@/lib/odds-api'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createOddsAPIClient()
    let totalUpserted = 0

    for (const [competition, sportKey] of Object.entries(ODDS_SPORT_KEYS)) {
      let events
      try {
        events = await client.getOdds(sportKey, MARKETS)
      } catch {
        // Some competitions may not be available — skip gracefully
        continue
      }

      for (const event of events) {
        // Find the match in our DB by team names and date
        const eventDate = event.commence_time.substring(0, 10)

        const { data: homeTeam } = await supabaseAdmin
          .from('teams')
          .select('id')
          .ilike('name', `%${event.home_team}%`)
          .single()

        const { data: awayTeam } = await supabaseAdmin
          .from('teams')
          .select('id')
          .ilike('name', `%${event.away_team}%`)
          .single()

        if (!homeTeam || !awayTeam) continue

        const { data: match } = await supabaseAdmin
          .from('matches')
          .select('id')
          .eq('home_team_id', homeTeam.id)
          .eq('away_team_id', awayTeam.id)
          .gte('match_date', `${eventDate}T00:00:00Z`)
          .lte('match_date', `${eventDate}T23:59:59Z`)
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
