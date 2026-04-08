// app/api/sync/rich/route.ts
import { NextResponse } from 'next/server'
import { createAPIFootballClient } from '@/lib/api-football'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createAPIFootballClient()
    let lineupsUpserted = 0
    let predictionsUpserted = 0

    const { data: matches, error } = await supabaseAdmin
      .from('matches')
      .select('id, api_football_id, home_team_id, away_team_id')
      .eq('status', 'NS')
      .not('api_football_id', 'is', null)

    if (error) throw new Error(`Failed to load matches: ${error.message}`)
    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: true, lineups: 0, predictions: 0 })
    }

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const match of matches) {
      await sleep(250)

      // --- Predictions ---
      try {
        const preds = await client.getPredictions(match.api_football_id)
        if (preds?.length) {
          const p = preds[0]
          await supabaseAdmin.from('match_predictions').upsert({
            match_id: match.id,
            winner_team_id: p.predictions.winner?.id ?? null,
            winner_name: p.predictions.winner?.name ?? null,
            win_or_draw: p.predictions.win_or_draw,
            under_over: p.predictions.under_over,
            advice: p.predictions.advice,
            home_win_percent: p.predictions.percent.home,
            draw_percent: p.predictions.percent.draw,
            away_win_percent: p.predictions.percent.away,
            home_form: p.teams.home.last_5?.form ?? null,
            away_form: p.teams.away.last_5?.form ?? null,
            comparison: p.comparison,
            fetched_at: new Date().toISOString(),
          }, { onConflict: 'match_id', ignoreDuplicates: false })
          predictionsUpserted++
        }
      } catch (err) {
        console.error(`Failed to fetch predictions for fixture ${match.api_football_id}:`, err)
      }

      await sleep(250)

      // --- Lineups ---
      try {
        const lineups = await client.getFixtureLineups(match.api_football_id)
        if (!lineups?.length) continue

        // Resolve both team IDs once, outside the loop
        const [homeAfId, awayAfId] = await Promise.all([
          getApiFootballTeamId(match.home_team_id),
          getApiFootballTeamId(match.away_team_id),
        ])

        for (const lineup of lineups) {
          const teamId = lineup.team.id === homeAfId
            ? match.home_team_id
            : lineup.team.id === awayAfId
              ? match.away_team_id
              : null

          if (!teamId) {
            console.warn(`Lineup team ID ${lineup.team.id} not recognised for match ${match.id}, skipping`)
            continue
          }

          await supabaseAdmin.from('match_lineups').upsert({
            match_id: match.id,
            team_id: teamId,
            formation: lineup.formation,
            start_xi: lineup.startXI.map(s => ({
              id: s.player.id,
              name: s.player.name,
              number: s.player.number,
              position: s.player.pos,
            })),
            substitutes: lineup.substitutes.map(s => ({
              id: s.player.id,
              name: s.player.name,
              number: s.player.number,
              position: s.player.pos,
            })),
            coach_name: lineup.coach.name,
            fetched_at: new Date().toISOString(),
          }, { onConflict: 'match_id,team_id', ignoreDuplicates: false })
          lineupsUpserted++
        }
      } catch (err) {
        console.error(`Failed to fetch lineups for fixture ${match.api_football_id}:`, err)
      }
    }

    return NextResponse.json({ success: true, lineups: lineupsUpserted, predictions: predictionsUpserted })
  } catch (err) {
    console.error('Rich sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function getApiFootballTeamId(teamUuid: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from('teams')
    .select('api_football_id')
    .eq('id', teamUuid)
    .single()
  return data?.api_football_id ?? null
}
