// app/api/accumulators/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: Request) {
  const { data, error } = await supabaseAdmin
    .from('accumulators')
    .select(`
      id, name, total_odds, ai_summary, created_at,
      legs:accumulator_legs(
        id, market, selection, odds, confidence, report_id,
        match:match_id(match_date, competition, home_team:home_team_id(name), away_team:away_team_id(name))
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accumulators: data ?? [] })
}

interface LegInput {
  matchId: string
  market: string
  selection: string
  odds: number
  confidence: 'High' | 'Medium' | 'Low'
  reportId: string | null
}

export async function POST(req: Request) {
  try {
    const { name, totalOdds, aiSummary, legs } = await req.json() as {
      name?: string
      totalOdds?: number
      aiSummary?: string | null
      legs?: LegInput[]
    }

    if (!name || totalOdds == null || !legs?.length) {
      return NextResponse.json({ error: 'name, totalOdds, and legs are required' }, { status: 400 })
    }

    const VALID_CONFIDENCE = new Set(['High', 'Medium', 'Low'])
    const invalidLeg = legs.find(
      l => !l.matchId || !l.market || !l.selection || l.odds == null || !VALID_CONFIDENCE.has(l.confidence)
    )
    if (invalidLeg) {
      return NextResponse.json(
        { error: 'Each leg requires matchId, market, selection, odds, and confidence (High|Medium|Low)' },
        { status: 400 }
      )
    }

    const { data: accu, error: accuError } = await supabaseAdmin
      .from('accumulators')
      .insert({ name, total_odds: totalOdds, ai_summary: aiSummary ?? null })
      .select('id')
      .single()

    if (accuError || !accu) {
      return NextResponse.json({ error: accuError?.message ?? 'Insert failed' }, { status: 500 })
    }

    const { error: legsError } = await supabaseAdmin
      .from('accumulator_legs')
      .insert(
        legs.map(l => ({
          accumulator_id: accu.id,
          match_id: l.matchId,
          market: l.market,
          selection: l.selection,
          odds: l.odds,
          confidence: l.confidence,
          report_id: l.reportId ?? null,
        }))
      )

    if (legsError) {
      await supabaseAdmin.from('accumulators').delete().eq('id', accu.id)
      return NextResponse.json({ error: legsError.message }, { status: 500 })
    }

    return NextResponse.json({ id: accu.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
