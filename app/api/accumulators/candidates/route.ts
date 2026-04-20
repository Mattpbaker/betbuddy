// app/api/accumulators/candidates/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { CandidateSelection, BetSuggestion } from '@/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawTimeframe = searchParams.get('timeframe') ?? '1'
  const days = parseInt(rawTimeframe, 10)

  if (isNaN(days) || (days !== 1 && days !== 3)) {
    return NextResponse.json({ error: 'timeframe must be 1 or 3' }, { status: 400 })
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select(`
      id, match_date, competition,
      home_team:home_team_id(name),
      away_team:away_team_id(name),
      report:reports!match_id(id, content)
    `)
    .gte('match_date', now.toISOString())
    .lte('match_date', cutoff.toISOString())
    .in('status', ['NS', 'TBD'])
    .order('match_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const candidates: CandidateSelection[] = []

  for (const match of matches ?? []) {
    const reportArr = Array.isArray(match.report) ? match.report : match.report ? [match.report] : []
    const report = reportArr[0]
    if (!report?.content?.suggestions?.length) continue

    const homeTeam = (match.home_team as unknown as { name: string } | null)?.name ?? ''
    const awayTeam = (match.away_team as unknown as { name: string } | null)?.name ?? ''

    const VALID_CONFIDENCE = new Set(['High', 'Medium', 'Low'])

    for (const s of report.content.suggestions as BetSuggestion[]) {
      if (typeof s.odds !== 'number' || !VALID_CONFIDENCE.has(s.confidence)) continue
      candidates.push({
        matchId: match.id,
        matchDate: match.match_date,
        competition: match.competition,
        homeTeam,
        awayTeam,
        reportId: report.id,
        label: s.label,
        market: s.market,
        selection: s.selection,
        odds: s.odds,
        confidence: s.confidence,
        reasoning: s.reasoning,
      })
    }
  }

  return NextResponse.json({ candidates })
}
