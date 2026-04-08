// app/api/cron/reports/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  // Find matches in next 48h without a report
  const { data: matches } = await supabaseAdmin
    .from('matches')
    .select('id')
    .gte('match_date', now.toISOString())
    .lte('match_date', fortyEightHoursFromNow.toISOString())
    .eq('status', 'NS')

  if (!matches || matches.length === 0) {
    return NextResponse.json({ success: true, generated: 0 })
  }

  // Filter to only matches without an existing report
  const { data: existingReports } = await supabaseAdmin
    .from('reports')
    .select('match_id')
    .in('match_id', matches.map(m => m.id))

  const reportedMatchIds = new Set(existingReports?.map(r => r.match_id) ?? [])
  const matchesNeedingReports = matches.filter(m => !reportedMatchIds.has(m.id))

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  // Generate reports sequentially to avoid overwhelming Claude API
  let generated = 0
  for (const match of matchesNeedingReports) {
    try {
      const res = await fetch(`${base}/api/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, triggeredBy: 'cron' }),
      })
      if (res.ok) generated++
    } catch (err) {
      console.error(`Failed to generate report for match ${match.id}:`, err)
    }
  }

  return NextResponse.json({ success: true, generated, total: matchesNeedingReports.length })
}
