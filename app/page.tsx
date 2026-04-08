import { supabase } from '@/lib/supabase'
import { DashboardClient } from '@/components/DashboardClient'
import type { Match } from '@/types'

export const dynamic = 'force-dynamic'

async function getMatches(): Promise<Match[]> {
  const in14Days = new Date()
  in14Days.setDate(in14Days.getDate() + 14)

  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:home_team_id(*),
      away_team:away_team_id(*),
      odds(*),
      report:reports(id, generated_at),
      prediction:match_predictions(*)
    `)
    .lte('match_date', in14Days.toISOString())
    .in('status', ['NS', '1H', 'HT', '2H', 'ET', 'BT', 'P'])
    .order('match_date', { ascending: true })

  if (error || !data) return []
  return data as Match[]
}

export default async function DashboardPage() {
  const matches = await getMatches()
  return <DashboardClient initialMatches={matches} />
}
