// app/api/sync/fixtures/route.ts
import { NextResponse } from 'next/server'
import { createOddsAPIClient, ODDS_SPORT_KEYS } from '@/lib/odds-api'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    const client = createOddsAPIClient()
    let totalUpserted = 0

    const errors: Record<string, string> = {}
    const counts: Record<string, number> = {}
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    for (const [competition, sportKey] of Object.entries(ODDS_SPORT_KEYS)) {
      await sleep(300)
      let fixtures
      try {
        fixtures = await client.getEvents(sportKey)
      } catch (err) {
        errors[competition] = String(err)
        continue
      }

      counts[competition] = Array.isArray(fixtures) ? fixtures.length : -1

      // Only process first fixture per competition for diagnostics
      const sample = fixtures[0]
      if (!sample) continue

      const { error: homeErr } = await supabaseAdmin.from('teams').upsert({
        name: sample.home_team,
        competition,
      }, { onConflict: 'name,competition', ignoreDuplicates: true })

      if (homeErr) {
        errors[`${competition}:team_upsert`] = homeErr.message
        continue
      }

      const { data: homeTeam, error: homeFetchErr } = await supabaseAdmin
        .from('teams').select('id').eq('name', sample.home_team).eq('competition', competition).single()

      if (homeFetchErr || !homeTeam) {
        errors[`${competition}:team_fetch`] = homeFetchErr?.message ?? 'not found'
        continue
      }

      errors[`${competition}:ok`] = `home team id=${homeTeam.id}`
    }

    return NextResponse.json({ success: true, upserted: totalUpserted, counts, errors })
  } catch (err) {
    console.error('Fixtures sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
