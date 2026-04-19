'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MatchExpandedPanel } from '@/components/MatchExpandedPanel'
import type { Match } from '@/types'

interface Props {
  match: Match
  showCompetition?: boolean
}

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P'])

function valueBet(match: Match): { label: string } | null {
  const pred = Array.isArray(match.prediction) ? match.prediction[0] : match.prediction
  if (!pred) return null

  const checks = [
    { label: 'HOME VALUE', pct: pred.home_win_percent, odds: match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Home')?.value },
    { label: 'DRAW VALUE', pct: pred.draw_percent,     odds: match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Draw')?.value },
    { label: 'AWAY VALUE', pct: pred.away_win_percent, odds: match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Away')?.value },
  ]
  for (const { label, pct, odds } of checks) {
    if (pct && odds && parseFloat(pct) > (1 / odds) * 100 + 12) return { label }
  }
  return null
}

export function MatchRow({ match, showCompetition }: Props) {
  const [expanded, setExpanded] = useState(false)

  const homeOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Home')
  const drawOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Draw')
  const awayOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Away')

  const isLive = LIVE_STATUSES.has(match.status)
  const value = valueBet(match)
  const hasReport = Array.isArray(match.report) ? match.report.length > 0 : !!match.report

  const matchDate = new Date(match.match_date)
  const timeStr = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  const dateStr = matchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

  async function addToSlip(e: React.MouseEvent, selection: string, odds: number) {
    e.stopPropagation()
    await fetch('/api/slip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, market: 'Match Winner', selection, odds }),
    })
    window.dispatchEvent(new Event('slip-updated'))
  }

  return (
    <>
      {/* Row — click to expand */}
      <div
        onClick={() => setExpanded(v => !v)}
        className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-[#1c2535] cursor-pointer transition-colors
          ${expanded ? 'bg-[#0a0e15]' : 'hover:bg-[#0d1117]'} group`}
      >
        {/* Chevron */}
        <span className={`text-[#3a4a5e] text-[10px] font-mono shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}>
          ›
        </span>

        {/* Date / Live */}
        <div className="text-[10px] text-[#3a4a5e] font-mono w-16 sm:w-20 shrink-0">
          {isLive ? (
            <>
              <div className="text-[#ff4444] font-bold animate-pulse">● LIVE</div>
              <div className="text-[#5a6a7e]">{match.status}</div>
            </>
          ) : (
            <>
              <div className="hidden sm:block">{dateStr}</div>
              <div className="sm:hidden">{matchDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</div>
              <div className="text-[#5a6a7e]">{timeStr}</div>
            </>
          )}
        </div>

        {/* Teams + score */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {showCompetition && (
              <span className="text-[9px] font-mono text-[#3a4a5e] bg-[#1c2535] px-1.5 py-0.5 rounded shrink-0 hidden sm:inline">
                {match.competition.replace('Champions League', 'UCL').replace('Europa League', 'UEL').replace('Premier League', 'PL')}
              </span>
            )}
            <span className="text-[13px] text-[#c0ccd8] font-medium truncate">{match.home_team?.name}</span>
            {isLive ? (
              <span className="text-[13px] text-white font-bold font-mono shrink-0 px-1 tabular-nums">
                {match.home_score ?? 0} - {match.away_score ?? 0}
              </span>
            ) : (
              <span className="text-[10px] text-[#3a4a5e] font-mono shrink-0">vs</span>
            )}
            <span className="text-[13px] text-[#c0ccd8] font-medium truncate">{match.away_team?.name}</span>
          </div>
          {value && (
            <div className="mt-0.5">
              <span className="text-[9px] font-mono text-[#f59e0b] bg-[#f59e0b10] border border-[#f59e0b30] px-1.5 py-0.5 rounded">
                ⚡ {value.label}
              </span>
            </div>
          )}
        </div>

        {/* Quick 1X2 odds */}
        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {[
            { label: '1', odds: homeOdds?.value, selection: 'Home' },
            { label: 'X', odds: drawOdds?.value, selection: 'Draw' },
            { label: '2', odds: awayOdds?.value, selection: 'Away' },
          ].map(({ label, odds, selection }) =>
            odds ? (
              <button
                key={label}
                onClick={e => addToSlip(e, selection, odds)}
                className="bg-[#1c2535] hover:bg-[#2a9d5c18] hover:border-[#2a9d5c44] border border-transparent rounded px-1.5 sm:px-2 py-1 font-mono text-[11px] text-[#8a9ab0] hover:text-[#c0ccd8] transition-colors"
              >
                <span className="text-[#5a6a7e]">{label}</span> {odds.toFixed(2)}
              </button>
            ) : null
          )}
        </div>

        {/* Right badges */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {hasReport ? (
            <span className="text-[9px] bg-[#2a9d5c18] border border-[#2a9d5c44] text-[#2a9d5c] font-mono px-1.5 py-0.5 rounded hidden sm:inline">
              AI READY
            </span>
          ) : (
            <span className="text-[9px] bg-[#1c2535] text-[#3a4a5e] font-mono px-1.5 py-0.5 rounded hidden sm:inline">
              NO REPORT
            </span>
          )}
          <Link
            href={`/matches/${match.id}`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-[#3a4a5e] hover:text-[#8a9ab0] font-mono opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block"
          >
            ↗
          </Link>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <MatchExpandedPanel
          matchId={match.id}
          initialOdds={match.odds ?? []}
        />
      )}
    </>
  )
}
