// app/api/sync/fixtures/route.ts
import { NextResponse } from 'next/server'
import { createAPIFootballClient, LEAGUE_IDS } from '@/lib/api-football'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createAPIFootballClient()
    let totalUpserted = 0

    for (const [competition, leagueId] of Object.entries(LEAGUE_IDS)) {
      const fixtures = await client.getUpcomingFixtures(leagueId, 14)

      for (const f of fixtures) {
        // Upsert home team
        await supabaseAdmin.from('teams').upsert({
          api_football_id: f.teams.home.id,
          name: f.teams.home.name,
          country: '',
          competition,
          logo_url: f.teams.home.logo,
        }, { onConflict: 'api_football_id', ignoreDuplicates: false })

        // Upsert away team
        await supabaseAdmin.from('teams').upsert({
          api_football_id: f.teams.away.id,
          name: f.teams.away.name,
          country: '',
          competition,
          logo_url: f.teams.away.logo,
        }, { onConflict: 'api_football_id', ignoreDuplicates: false })

        // Get team IDs
        const { data: homeTeam } = await supabaseAdmin
          .from('teams').select('id').eq('api_football_id', f.teams.home.id).single()
        const { data: awayTeam } = await supabaseAdmin
          .from('teams').select('id').eq('api_football_id', f.teams.away.id).single()

        if (!homeTeam || !awayTeam) continue

        // Upsert match
        await supabaseAdmin.from('matches').upsert({
          api_football_id: f.fixture.id,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          competition,
          match_date: f.fixture.date,
          venue: f.fixture.venue?.name ?? null,
          status: f.fixture.status.short,
        }, { onConflict: 'api_football_id', ignoreDuplicates: false })

        totalUpserted++
      }
    }

    return NextResponse.json({ success: true, upserted: totalUpserted })
  } catch (err) {
    console.error('Fixtures sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
