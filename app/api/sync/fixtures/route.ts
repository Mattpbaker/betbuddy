// app/api/sync/fixtures/route.ts
import { NextResponse } from 'next/server'
import { createAPIFootballClient, LEAGUE_IDS, getCurrentSeason } from '@/lib/api-football'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createAPIFootballClient()
    const season = getCurrentSeason()
    const now = new Date()
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const from = now.toISOString().slice(0, 10)
    const to = in14Days.toISOString().slice(0, 10)

    let totalUpserted = 0
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const [competition, leagueId] of Object.entries(LEAGUE_IDS)) {
      await sleep(300)

      let fixtures
      try {
        fixtures = await client.getFixturesForDateRange(leagueId, season, from, to)
      } catch {
        continue
      }

      for (const f of fixtures) {
        const homeTeamData = {
          api_football_id: f.teams.home.id,
          name: f.teams.home.name,
          logo_url: f.teams.home.logo,
          competition,
          country: '',
        }
        const awayTeamData = {
          api_football_id: f.teams.away.id,
          name: f.teams.away.name,
          logo_url: f.teams.away.logo,
          competition,
          country: '',
        }

        // Upsert teams on name+competition so existing rows (with api_football_id=null) get updated
        const [{ error: homeErr }, { error: awayErr }] = await Promise.all([
          supabaseAdmin.from('teams').upsert(homeTeamData, {
            onConflict: 'name,competition',
            ignoreDuplicates: false,
          }),
          supabaseAdmin.from('teams').upsert(awayTeamData, {
            onConflict: 'name,competition',
            ignoreDuplicates: false,
          }),
        ])

        if (homeErr || awayErr) {
          console.error(`Team upsert error for ${f.teams.home.name} vs ${f.teams.away.name}:`, homeErr?.message ?? awayErr?.message)
          continue
        }

        // Also explicitly set api_football_id in case upsert didn't update it
        await Promise.all([
          supabaseAdmin.from('teams').update({ api_football_id: f.teams.home.id, logo_url: f.teams.home.logo })
            .eq('name', f.teams.home.name).eq('competition', competition),
          supabaseAdmin.from('teams').update({ api_football_id: f.teams.away.id, logo_url: f.teams.away.logo })
            .eq('name', f.teams.away.name).eq('competition', competition),
        ])

        // Fetch team UUIDs by name+competition (reliable regardless of api_football_id state)
        const [{ data: homeTeam }, { data: awayTeam }] = await Promise.all([
          supabaseAdmin.from('teams').select('id').eq('name', f.teams.home.name).eq('competition', competition).single(),
          supabaseAdmin.from('teams').select('id').eq('name', f.teams.away.name).eq('competition', competition).single(),
        ])

        if (!homeTeam || !awayTeam) continue

        const { error: matchErr } = await supabaseAdmin.from('matches').upsert({
          api_football_id: f.fixture.id,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          competition,
          match_date: f.fixture.date,
          venue: f.fixture.venue?.name ?? null,
          status: f.fixture.status.short,
          round: f.league.round,
        }, { onConflict: 'api_football_id', ignoreDuplicates: false })

        if (matchErr) continue
        totalUpserted++
      }
    }

    return NextResponse.json({ success: true, upserted: totalUpserted })
  } catch (err) {
    console.error('Fixtures sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
