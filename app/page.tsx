import { supabase } from '@/lib/supabase'
import { MatchRow } from '@/components/MatchRow'
import type { Match } from '@/types'

async function getUpcomingMatches(): Promise<Record<string, Match[]>> {
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 14)

  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:home_team_id(*),
      away_team:away_team_id(*),
      odds(*),
      report:reports(id, generated_at)
    `)
    .gte('match_date', new Date().toISOString())
    .lte('match_date', sevenDaysFromNow.toISOString())
    .eq('status', 'NS')
    .order('match_date', { ascending: true })

  if (error || !data) return {}

  // Group by competition
  return data.reduce((acc, match) => {
    const key = match.competition
    if (!acc[key]) acc[key] = []
    acc[key].push(match as Match)
    return acc
  }, {} as Record<string, Match[]>)
}

export default async function DashboardPage() {
  const matchesByCompetition = await getUpcomingMatches()
  const competitions = Object.keys(matchesByCompetition)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-['Rajdhani'] text-2xl font-bold text-white tracking-widest uppercase">
          Upcoming Matches
        </h1>
        <div className="flex gap-2">
          <form action="/api/sync/fixtures" method="POST">
            <button
              type="submit"
              className="text-[10px] font-mono tracking-widest text-[#5a6a7e] hover:text-[#8a9ab0] border border-[#1c2535] rounded px-3 py-1.5 hover:bg-[#1c2535] transition-colors"
            >
              SYNC FIXTURES
            </button>
          </form>
          <form action="/api/sync/odds" method="POST">
            <button
              type="submit"
              className="text-[10px] font-mono tracking-widest text-[#5a6a7e] hover:text-[#8a9ab0] border border-[#1c2535] rounded px-3 py-1.5 hover:bg-[#1c2535] transition-colors"
            >
              SYNC ODDS
            </button>
          </form>
          <form action="/api/sync/rich" method="POST">
            <button
              type="submit"
              className="text-[10px] font-mono tracking-widest text-[#5a6a7e] hover:text-[#8a9ab0] border border-[#1c2535] rounded px-3 py-1.5 hover:bg-[#1c2535] transition-colors"
            >
              SYNC RICH
            </button>
          </form>
        </div>
      </div>

      {competitions.length === 0 ? (
        <div className="text-center py-20 text-[#3a4a5e] font-mono text-sm">
          No matches found. Click SYNC FIXTURES to pull upcoming games.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {competitions.map(competition => (
            <section key={competition}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2a9d5c]" />
                <h2 className="font-mono text-[11px] text-[#5a6a7e] tracking-[0.1em] uppercase">
                  {competition} · {matchesByCompetition[competition].length} matches
                </h2>
              </div>
              <div className="bg-[#0d1117] border border-[#1c2535] rounded-lg overflow-hidden">
                {matchesByCompetition[competition].map(match => (
                  <MatchRow key={match.id} match={match} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
