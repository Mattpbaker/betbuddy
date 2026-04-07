import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OddsPanel } from '@/components/OddsPanel'
import { ReportPanel } from '@/components/ReportPanel'
import type { Match, Report } from '@/types'

async function getMatch(id: string): Promise<Match | null> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:home_team_id(*),
      away_team:away_team_id(*),
      odds(*),
      report:reports(*)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as Match
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const match = await getMatch(id)
  if (!match) notFound()

  const matchDate = new Date(match.match_date)
  // Supabase returns report as an array from the join — take first element
  const report = Array.isArray(match.report)
    ? (match.report[0] as Report ?? null)
    : (match.report as Report ?? null)

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Match header */}
      <div className="bg-[#0d1117] border border-[#1c2535] rounded-xl p-5">
        <div className="inline-flex items-center gap-2 bg-[#2a9d5c18] border border-[#2a9d5c33] rounded px-2 py-1 font-mono text-[10px] text-[#2a9d5c] tracking-widest mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2a9d5c]" />
          {match.competition.toUpperCase()}
        </div>
        <div className="flex items-center gap-5">
          <h1 className="font-['Rajdhani'] text-3xl font-bold text-white tracking-wide uppercase">
            {match.home_team?.name}
          </h1>
          <span className="font-mono text-xs text-[#3a4a5e] tracking-widest shrink-0">VS</span>
          <h1 className="font-['Rajdhani'] text-3xl font-bold text-white tracking-wide uppercase">
            {match.away_team?.name}
          </h1>
        </div>
        <div className="flex gap-5 mt-3">
          <span className="font-mono text-[11px] text-[#5a6a7e]">
            📅 {matchDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {match.venue && (
            <span className="font-mono text-[11px] text-[#5a6a7e]">🏟 {match.venue}</span>
          )}
        </div>
      </div>

      {/* Odds */}
      <OddsPanel odds={match.odds ?? []} matchId={match.id} />

      {/* AI Report */}
      <ReportPanel report={report} matchId={match.id} />
    </div>
  )
}
