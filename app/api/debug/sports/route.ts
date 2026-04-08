// app/api/debug/sports/route.ts
// Temporary: lists all available soccer sport keys from The Odds API
import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.ODDS_API_KEY
  if (!key) return NextResponse.json({ error: 'ODDS_API_KEY not set' }, { status: 500 })

  const res = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${key}&all=true`)
  if (!res.ok) return NextResponse.json({ error: `${res.status} ${res.statusText}` }, { status: 500 })

  const sports = await res.json()
  const soccer = sports.filter((s: { group: string; key: string; title: string; active: boolean }) => s.group === 'Soccer')

  return NextResponse.json(soccer.map((s: { key: string; title: string; active: boolean }) => ({
    key: s.key,
    title: s.title,
    active: s.active,
  })))
}
