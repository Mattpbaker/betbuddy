// app/api/slip/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET: return the active draft slip with items
export async function GET() {
  // Get or create draft slip
  let { data: slip } = await supabaseAdmin
    .from('bet_slip')
    .select('*')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!slip) {
    const { data: newSlip } = await supabaseAdmin
      .from('bet_slip')
      .insert({ stake: 10, status: 'draft' })
      .select()
      .single()
    slip = newSlip
  }

  const { data: items } = await supabaseAdmin
    .from('bet_slip_items')
    .select('*, match:match_id(*, home_team:home_team_id(name), away_team:away_team_id(name))')
    .eq('slip_id', slip.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ ...slip, items: items ?? [] })
}

// POST: add an item to the slip
export async function POST(req: Request) {
  const { matchId, market, selection, odds, reportId } = await req.json()

  if (!matchId || !market || !selection || !odds) {
    return NextResponse.json({ error: 'matchId, market, selection, odds required' }, { status: 400 })
  }

  // Get or create draft slip
  let { data: slip } = await supabaseAdmin
    .from('bet_slip')
    .select('id')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!slip) {
    const { data: newSlip } = await supabaseAdmin
      .from('bet_slip')
      .insert({ stake: 10, status: 'draft' })
      .select('id')
      .single()
    slip = newSlip
  }

  // Prevent duplicates — same match + market + selection
  const { data: existing } = await supabaseAdmin
    .from('bet_slip_items')
    .select('id')
    .eq('slip_id', slip!.id)
    .eq('match_id', matchId)
    .eq('market', market)
    .eq('selection', selection)
    .single()

  if (existing) {
    return NextResponse.json({ duplicate: true, id: existing.id })
  }

  const { data: item, error } = await supabaseAdmin
    .from('bet_slip_items')
    .insert({
      slip_id: slip!.id,
      match_id: matchId,
      market,
      selection,
      odds,
      report_id: reportId ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(item)
}

// DELETE: clear the entire slip (archive it)
export async function DELETE() {
  await supabaseAdmin
    .from('bet_slip')
    .update({ status: 'archived' })
    .eq('status', 'draft')

  return NextResponse.json({ success: true })
}
