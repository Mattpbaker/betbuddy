// app/api/cron/sync/route.ts
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  // Verify this is called by Vercel Cron (or our CRON_SECRET)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  // Run fixtures and odds sync in parallel
  const [fixturesRes, oddsRes] = await Promise.all([
    fetch(`${base}/api/sync/fixtures`, { method: 'POST' }),
    fetch(`${base}/api/sync/odds`, { method: 'POST' }),
  ])

  const fixtures = await fixturesRes.json()
  const odds = await oddsRes.json()

  return NextResponse.json({
    success: true,
    fixtures,
    odds,
    timestamp: new Date().toISOString(),
  })
}
