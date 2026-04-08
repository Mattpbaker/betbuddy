'use client'
import Link from 'next/link'
import type { Match } from '@/types'

interface Props {
  match: Match
  showCompetition?: boolean
}

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P'])

function valueBet(match: Match): { label: string; side: 'home' | 'away' | 'draw' } | null {
  const pred = Array.isArray(match.prediction) ? match.prediction[0] : match.prediction
  if (!pred) return null

  const homeOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Home')
  const drawOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Draw')
  const awayOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Away')

  const checks: { side: 'home' | 'away' | 'draw'; predicted: number | null; odds: number | null }[] = [
    { side: 'home', predicted: pred.home_win_percent ? parseFloat(pred.home_win_percent) : null, odds: homeOdds?.value ?? null },
    { side: 'draw', predicted: pred.draw_percent ? parseFloat(pred.draw_percent) : null, odds: drawOdds?.value ?? null },
    { side: 'away', predicted: pred.away_win_percent ? parseFloat(pred.away_win_percent) : null, odds: awayOdds?.value ?? null },
  ]

  for (const { side, predicted, odds } of checks) {
    if (predicted && odds) {
      const implied = (1 / odds) * 100
      if (predicted > implied + 12) {
        return { label: `${side.toUpperCase()} VALUE`, side }
      }
    }
  }
  return null
}

export function MatchRow({ match, showCompetition }: Props) {
  const homeOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Home')
  const drawOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Draw')
  const awayOdds = match.odds?.find(o => o.market === 'Match Winner' && o.selection === 'Away')

  const isLive = LIVE_STATUSES.has(match.status)
  const value = valueBet(match)

  const matchDate = new Date(match.match_date)
  const timeStr = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  const dateStr = matchDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

  async function addToSlip(selection: string, odds: number, market: string) {
    await fetch('/api/slip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, market, selection, odds }),
    })
    window.dispatchEvent(new Event('slip-updated'))
  }

  const hasReport = Array.isArray(match.report) ? match.report.length > 0 : !!match.report

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-[#1c2535] hover:bg-[#0d1117] transition-colors group last:border-b-0">
      {/* Date / Live indicator */}
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
      <Link href={`/matches/${match.id}`} className="flex-1 min-w-0">
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
      </Link>

      {/* Odds */}
      <div className="flex gap-1 shrink-0">
        {[
          { label: '1', odds: homeOdds?.value, selection: 'Home' },
          { label: 'X', odds: drawOdds?.value, selection: 'Draw' },
          { label: '2', odds: awayOdds?.value, selection: 'Away' },
        ].map(({ label, odds, selection }) =>
          odds ? (
            <button
              key={label}
              onClick={() => addToSlip(selection, odds, 'Match Winner')}
              className="bg-[#1c2535] hover:bg-[#2a9d5c18] hover:border-[#2a9d5c44] border border-transparent rounded px-1.5 sm:px-2 py-1 font-mono text-[11px] text-[#8a9ab0] hover:text-[#c0ccd8] transition-colors"
            >
              <span className="text-[#5a6a7e]">{label}</span>{' '}
              {odds.toFixed(2)}
            </button>
          ) : null
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
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
          className="text-[10px] text-[#3a4a5e] hover:text-[#8a9ab0] font-mono opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block"
        >
          VIEW →
        </Link>
      </div>
    </div>
  )
}
