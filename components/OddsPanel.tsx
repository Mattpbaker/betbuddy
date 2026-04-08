'use client'
import { useState } from 'react'
import type { Odd } from '@/types'

const MARKET_LABELS: Record<string, string> = {
  'Match Winner': 'Match Result (1X2)',
  'Double Chance': 'Double Chance',
  'Goals Over/Under': 'Over / Under Goals',
  'Both Teams Score': 'Both Teams to Score',
  'First Half Winner': 'Half Time Result',
}

interface Props {
  odds: Odd[]
  matchId: string
}

export function OddsPanel({ odds, matchId }: Props) {
  const markets = [...new Set(odds.map(o => o.market))].filter(m => MARKET_LABELS[m])
  const [activeMarket, setActiveMarket] = useState(markets[0] ?? 'h2h')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const marketOdds = odds.filter(o => o.market === activeMarket)

  async function toggleSelection(odd: Odd) {
    const key = `${odd.market}:${odd.selection}`
    if (selected.has(key)) {
      setSelected(prev => { const s = new Set(prev); s.delete(key); return s })
    } else {
      setSelected(prev => new Set(prev).add(key))
      await fetch('/api/slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, market: odd.market, selection: odd.selection, odds: odd.value }),
      })
      window.dispatchEvent(new Event('slip-updated'))
    }
  }

  return (
    <div>
      <h2 className="font-mono text-[11px] text-[#5a6a7e] tracking-[0.1em] uppercase mb-3">Odds</h2>
      <div className="flex gap-2 mb-3 flex-wrap">
        {markets.map(market => (
          <button
            key={market}
            onClick={() => setActiveMarket(market)}
            className={`px-3 py-1.5 rounded font-mono text-[10px] tracking-wider border transition-colors
              ${activeMarket === market
                ? 'bg-[#1c2535] text-[#e0e6f0] border-[#2a4a5e]'
                : 'bg-transparent text-[#5a6a7e] border-[#1c2535] hover:bg-[#1c2535]'
              }`}
          >
            {MARKET_LABELS[market] ?? market}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {marketOdds.map(odd => {
          const key = `${odd.market}:${odd.selection}`
          const isSelected = selected.has(key)
          return (
            <button
              key={odd.id}
              onClick={() => toggleSelection(odd)}
              className={`rounded-md p-3 text-left border transition-all
                ${isSelected
                  ? 'border-[#2a9d5c] bg-[#2a9d5c12]'
                  : 'border-[#1c2535] bg-[#0d1117] hover:border-[#2a9d5c55]'
                }`}
            >
              <div className="text-[10px] text-[#5a6a7e] mb-1">{odd.selection}</div>
              <div className="font-mono text-sm text-[#e0e6f0] font-medium">{odd.value.toFixed(2)}</div>
              {isSelected && <div className="text-[8px] text-[#2a9d5c] font-mono mt-1">✓ ADDED</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
