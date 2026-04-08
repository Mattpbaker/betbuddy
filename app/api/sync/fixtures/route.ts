// app/api/sync/fixtures/route.ts
import { NextResponse } from 'next/server'
import { createOddsAPIClient, ODDS_SPORT_KEYS } from '@/lib/odds-api'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createOddsAPIClient()
    let totalUpserted = 0

    const errors: Record<string, string> = {}
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const [competition, sportKey] of Object.entries(ODDS_SPORT_KEYS)) {
      await sleep(300)
      let fixtures
      try {
        fixtures = await client.getEvents(sportKey)
      } catch (err) {
        errors[competition] = String(err)
        continue
      }

      for (const f of fixtures) {
        // Upsert home team (conflict on name + competition)
        await supabaseAdmin.from('teams').upsert({
          name: f.home_team,
          competition,
        }, { onConflict: 'name,competition', ignoreDuplicates: true })

        // Upsert away team
        await supabaseAdmin.from('teams').upsert({
          name: f.away_team,
          competition,
        }, { onConflict: 'name,competition', ignoreDuplicates: true })

        // Fetch the team UUIDs we just upserted
        const [{ data: homeTeam }, { data: awayTeam }] = await Promise.all([
          supabaseAdmin.from('teams').select('id').eq('name', f.home_team).eq('competition', competition).single(),
          supabaseAdmin.from('teams').select('id').eq('name', f.away_team).eq('competition', competition).single(),
        ])

        if (!homeTeam || !awayTeam) continue

        // Upsert match (conflict on odds_event_id)
        await supabaseAdmin.from('matches').upsert({
          odds_event_id: f.id,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          competition,
          match_date: f.commence_time,
          status: 'scheduled',
        }, { onConflict: 'odds_event_id', ignoreDuplicates: false })

        totalUpserted++
      }
    }

    return NextResponse.json({ success: true, upserted: totalUpserted, errors })
  } catch (err) {
    console.error('Fixtures sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
