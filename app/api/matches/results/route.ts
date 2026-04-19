import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 7)
  since.setUTCHours(0, 0, 0, 0)

  const todayEnd = new Date()
  todayEnd.setUTCHours(0, 0, 0, 0)

  const { data, error } = await supabaseAdmin
    .from('matches')
    .select(`
      *,
      home_team:home_team_id(*),
      away_team:away_team_id(*),
      odds(*),
      report:reports(id, generated_at),
      prediction:match_predictions(*)
    `)
    .gte('match_date', since.toISOString())
    .lt('match_date', todayEnd.toISOString())
    .eq('status', 'FT')
    .order('match_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
