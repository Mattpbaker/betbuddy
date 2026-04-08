// app/api/sync/fixtures/route.ts
import { NextResponse } from 'next/server'
import { createOddsAPIClient, ODDS_SPORT_KEYS } from '@/lib/odds-api'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createOddsAPIClient()
    let totalUpserted = 0
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const [competition, sportKey] of Object.entries(ODDS_SPORT_KEYS)) {
      await sleep(300)
      let fixtures
      try {
        fixtures = await client.getEvents(sportKey)
      } catch {
        continue
      }

      for (const f of fixtures) {
        const [{ error: homeErr }, { error: awayErr }] = await Promise.all([
          supabaseAdmin.from('teams').upsert(
            { name: f.home_team, competition, country: '' },
            { onConflict: 'name,competition', ignoreDuplicates: true }
          ),
          supabaseAdmin.from('teams').upsert(
            { name: f.away_team, competition, country: '' },
            { onConflict: 'name,competition', ignoreDuplicates: true }
          ),
        ])

        if (homeErr || awayErr) continue

        const [{ data: homeTeam }, { data: awayTeam }] = await Promise.all([
          supabaseAdmin.from('teams').select('id').eq('name', f.home_team).eq('competition', competition).single(),
          supabaseAdmin.from('teams').select('id').eq('name', f.away_team).eq('competition', competition).single(),
        ])

        if (!homeTeam || !awayTeam) continue

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

    return NextResponse.json({ success: true, upserted: totalUpserted })
  } catch (err) {
    console.error('Fixtures sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
