'use client'
import { useState, useEffect } from 'react'
import type { BetSlipItem } from '@/types'

export function BetSlipPanel() {
  const [items, setItems] = useState<BetSlipItem[]>([])
  const [stake, setStake] = useState(10)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchSlip()
    window.addEventListener('slip-updated', fetchSlip)
    return () => window.removeEventListener('slip-updated', fetchSlip)
  }, [])

  async function fetchSlip() {
    const res = await fetch('/api/slip')
    if (res.ok) {
      const data = await res.json()
      setItems(data.items ?? [])
      if (data.stake) setStake(data.stake)
    }
  }

  async function removeItem(id: string) {
    await fetch(`/api/slip/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const totalOdds = items.reduce((acc, item) => acc * item.odds, 1)
  const estReturn = (stake * totalOdds).toFixed(2)

  return (
    <aside className="w-56 border-l border-[#1c2535] bg-[#0a0e13] flex flex-col shrink-0 hidden lg:flex">
      <div className="px-4 py-3 border-b border-[#1c2535] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-['Rajdhani'] text-sm font-bold text-[#2a9d5c] tracking-widest uppercase">
            Bet Slip
          </span>
          {items.length > 0 && (
            <span className="text-[9px] font-mono bg-[#2a9d5c] text-[#080c10] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {items.length}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={async () => {
              await fetch('/api/slip', { method: 'DELETE' })
              setItems([])
            }}
            className="text-[10px] text-[#3a4a5e] font-mono tracking-widest hover:text-[#8a9ab0] transition-colors"
          >
            CLEAR
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-[11px] text-[#3a4a5e] font-mono">No selections yet</p>
            <p className="text-[10px] text-[#2a3540] font-mono mt-2">Click odds buttons<br />to add to slip</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="bg-[#0d1117] border border-[#1c2535] rounded-md p-2 group/item">
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-[#4a5a6e] font-mono leading-tight">
                  {item.match?.home_team?.name} vs {item.match?.away_team?.name}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-[#3a4a5e] hover:text-[#e54242] text-xs ml-1 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
              <div className="text-[11px] text-[#3a4a5e] font-mono mt-0.5 uppercase tracking-wider">
                {item.market}
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="text-[12px] text-[#c0ccd8] font-medium">{item.selection}</div>
                <div className="text-[13px] font-mono text-[#2a9d5c] font-bold">{item.odds.toFixed(2)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="p-3 border-t border-[#1c2535]">
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a6a7e] font-mono text-sm">£</span>
            <input
              type="number"
              value={stake}
              onChange={e => setStake(Number(e.target.value))}
              className="w-full bg-[#0d1117] border border-[#2a4a5e] rounded-md pl-7 pr-3 py-2 font-mono text-sm text-[#e0e6f0] outline-none focus:border-[#2a9d5c] transition-colors"
              placeholder="10"
            />
          </div>

          <div className="space-y-1.5 mb-3">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-[#5a6a7e]">SELECTIONS</span>
              <span className="text-[#8a9ab0]">{items.length}</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-[#5a6a7e]">ACCA ODDS</span>
              <span className="text-[#2a9d5c]">×{totalOdds.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono border-t border-[#1c2535] pt-1.5 mt-1">
              <span className="text-[#5a6a7e]">EST. RETURN</span>
              <span className="text-[#2a9d5c] font-bold">£{estReturn}</span>
            </div>
          </div>

          <a
            href="/slip"
            className="block w-full bg-gradient-to-r from-[#2a9d5c] to-[#1e7a47] text-white text-center font-['Rajdhani'] font-bold text-sm tracking-widest uppercase py-2 rounded-md hover:from-[#32b86a] hover:to-[#2a9d5c] transition-all"
          >
            View Full Slip
          </a>
        </div>
      )}
    </aside>
  )
}
