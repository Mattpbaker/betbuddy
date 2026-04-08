// app/api/reports/generate/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateReport } from '@/lib/research-agent'
import { createAPIFootballClient, LEAGUE_IDS } from '@/lib/api-football'

export async function POST(req: Request) {
  try {
    const { matchId, triggeredBy = 'manual' } = await req.json()

    if (!matchId) {
      return NextResponse.json({ error: 'matchId required' }, { status: 400 })
    }

    const { data: match, error } = await supabaseAdmin
      .from('matches')
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
      .eq('id', matchId)
      .single()

    if (error || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const footballClient = createAPIFootballClient()
    const competition = match.competition as keyof typeof LEAGUE_IDS

    // Fetch cached form data (24h TTL)
    const [{ data: homeFormCache }, { data: awayFormCache }] = await Promise.all([
      supabaseAdmin.from('team_form').select('*').eq('team_id', match.home_team.id)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).single(),
      supabaseAdmin.from('team_form').select('*').eq('team_id', match.away_team.id)
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).single(),
    ])

    // Fetch prediction and lineups from DB (synced by /api/sync/rich)
    const [{ data: predictionRow }, { data: lineupsData }] = await Promise.all([
      supabaseAdmin.from('match_predictions').select('*').eq('match_id', matchId).single(),
      supabaseAdmin.from('match_lineups').select('*').eq('match_id', matchId),
    ])

    const homeLineup = lineupsData?.find(l => l.team_id === match.home_team_id) ?? null
    const awayLineup = lineupsData?.find(l => l.team_id === match.away_team_id) ?? null

    // Fetch live data from API-Football for what's not cached
    const [homeFormRaw, awayFormRaw, h2h, homeInjuries, awayInjuries, standings] = await Promise.all([
      homeFormCache
        ? Promise.resolve(homeFormCache.last_5_results)
        : footballClient.getTeamLastFiveResults(match.home_team.api_football_id).catch(() => []),
      awayFormCache
        ? Promise.resolve(awayFormCache.last_5_results)
        : footballClient.getTeamLastFiveResults(match.away_team.api_football_id).catch(() => []),
      footballClient.getHeadToHead(match.home_team.api_football_id, match.away_team.api_football_id).catch(() => []),
      match.api_football_id
        ? footballClient.getInjuries(match.api_football_id, match.home_team.api_football_id).catch(() => [])
        : Promise.resolve([]),
      match.api_football_id
        ? footballClient.getInjuries(match.api_football_id, match.away_team.api_football_id).catch(() => [])
        : Promise.resolve([]),
      (LEAGUE_IDS[competition]
        ? footballClient.getStandings(LEAGUE_IDS[competition])
        : Promise.resolve([])
      ).catch(() => []),
    ])

    const homeForm = homeFormCache ? homeFormCache.last_5_results : homeFormRaw
    const awayForm = awayFormCache ? awayFormCache.last_5_results : awayFormRaw

    // Cache form data
    if (!homeFormCache && Array.isArray(homeFormRaw) && homeFormRaw.length) {
      await supabaseAdmin.from('team_form').upsert({
        team_id: match.home_team.id,
        last_5_results: homeFormRaw,
        goals_scored_last5: homeFormRaw.reduce((a: number, f: any) => a + (f.goals?.home ?? 0), 0),
        goals_conceded_last5: homeFormRaw.reduce((a: number, f: any) => a + (f.goals?.away ?? 0), 0),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'team_id' })
    }
    if (!awayFormCache && Array.isArray(awayFormRaw) && awayFormRaw.length) {
      await supabaseAdmin.from('team_form').upsert({
        team_id: match.away_team.id,
        last_5_results: awayFormRaw,
        goals_scored_last5: awayFormRaw.reduce((a: number, f: any) => a + (f.goals?.away ?? 0), 0),
        goals_conceded_last5: awayFormRaw.reduce((a: number, f: any) => a + (f.goals?.home ?? 0), 0),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'team_id' })
    }

    const reportContent = await generateReport(
      match.home_team.name,
      match.away_team.name,
      {
        homeForm,
        awayForm,
        h2h,
        homeInjuries,
        awayInjuries,
        standings,
        prediction: predictionRow ?? null,
        homeLineup,
        awayLineup,
      }
    )

    const { error: upsertError } = await supabaseAdmin.from('reports').upsert({
      match_id: matchId,
      content: reportContent,
      generated_at: new Date().toISOString(),
      triggered_by: triggeredBy,
    }, { onConflict: 'match_id' })

    if (upsertError) throw upsertError

    return NextResponse.json({ success: true, report: reportContent })
  } catch (err) {
    console.error('Report generation error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
