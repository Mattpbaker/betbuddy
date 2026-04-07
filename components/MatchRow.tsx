'use client'
import Link from 'next/link'
import type { Match } from '@/types'

interface Props {
  match: Match
}

export function MatchRow({ match }: Props) {
  const homeOdds = match.odds?.find(o => o.market === 'h2h' && o.selection === match.home_team?.name)
  const drawOdds = match.odds?.find(o => o.market === 'h2h' && o.selection === 'Draw')
  const awayOdds = match.odds?.find(o => o.market === 'h2h' && o.selection === match.away_team?.name)

  const matchDate = new Date(match.match_date)
  const timeStr = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = matchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  async function addToSlip(selection: string, odds: number, market: string) {
    await fetch('/api/slip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, market, selection, odds }),
    })
    window.dispatchEvent(new Event('slip-updated'))
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1c2535] hover:bg-[#0d1117] transition-colors group">
      <div className="text-[10px] text-[#3a4a5e] font-mono w-20 shrink-0">
        <div>{dateStr}</div>
        <div className="text-[#5a6a7e]">{timeStr}</div>
      </div>

      <Link href={`/matches/${match.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#c0ccd8] font-medium truncate">
            {match.home_team?.name}
          </span>
          <span className="text-[10px] text-[#3a4a5e] font-mono shrink-0">vs</span>
          <span className="text-[13px] text-[#c0ccd8] font-medium truncate">
            {match.away_team?.name}
          </span>
        </div>
      </Link>

      <div className="flex gap-1 shrink-0">
        {[
          { label: '1', odds: homeOdds?.value, selection: match.home_team?.name ?? '', market: 'h2h' },
          { label: 'X', odds: drawOdds?.value, selection: 'Draw', market: 'h2h' },
          { label: '2', odds: awayOdds?.value, selection: match.away_team?.name ?? '', market: 'h2h' },
        ].map(({ label, odds, selection, market }) => (
          odds ? (
            <button
              key={label}
              onClick={() => addToSlip(selection, odds, market)}
              className="bg-[#1c2535] hover:bg-[#2a9d5c18] hover:border-[#2a9d5c44] border border-transparent rounded px-2 py-1 font-mono text-[11px] text-[#8a9ab0] hover:text-[#c0ccd8] transition-colors"
            >
              {label} {odds.toFixed(2)}
            </button>
          ) : null
        ))}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {match.report ? (
          <span className="text-[9px] bg-[#2a9d5c18] border border-[#2a9d5c44] text-[#2a9d5c] font-mono px-2 py-0.5 rounded">
            AI READY
          </span>
        ) : (
          <span className="text-[9px] bg-[#1c2535] text-[#3a4a5e] font-mono px-2 py-0.5 rounded">
            NO REPORT
          </span>
        )}
        <Link
          href={`/matches/${match.id}`}
          className="text-[10px] text-[#3a4a5e] hover:text-[#8a9ab0] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
        >
          VIEW →
        </Link>
      </div>
    </div>
  )
}
