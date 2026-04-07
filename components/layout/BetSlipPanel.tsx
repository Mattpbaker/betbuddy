'use client'
import { useState, useEffect } from 'react'
import type { BetSlipItem } from '@/types'

export function BetSlipPanel() {
  const [items, setItems] = useState<BetSlipItem[]>([])
  const [stake, setStake] = useState(10)

  useEffect(() => {
    fetchSlip()
    // Re-fetch when items are added from elsewhere (dashboard, match detail)
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
    <aside className="w-60 border-l border-[#1c2535] bg-[#0a0e13] flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-[#1c2535] flex items-center justify-between">
        <span className="font-['Rajdhani'] text-sm font-bold text-[#2a9d5c] tracking-widest uppercase">
          Bet Slip
        </span>
        {items.length > 0 && (
          <button
            onClick={async () => {
              await fetch('/api/slip', { method: 'DELETE' })
              setItems([])
            }}
            className="text-[10px] text-[#3a4a5e] font-mono tracking-widest hover:text-[#8a9ab0]"
          >
            CLEAR
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-[11px] text-[#3a4a5e] font-mono text-center mt-8">No selections yet</p>
        ) : (
          items.map(item => (
            <div key={item.id} className="bg-[#0d1117] border border-[#1c2535] rounded-md p-2">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-[#4a5a6e] font-mono block mb-1 leading-tight">
                  {item.match?.home_team?.name} vs {item.match?.away_team?.name}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-[#3a4a5e] hover:text-[#8a9ab0] text-xs ml-1"
                >
                  ✕
                </button>
              </div>
              <div className="text-[12px] text-[#c0ccd8] font-medium">{item.selection}</div>
              <div className="text-[13px] font-mono text-[#2a9d5c] font-medium">{item.odds}</div>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="p-3 border-t border-[#1c2535]">
          <input
            type="number"
            value={stake}
            onChange={e => setStake(Number(e.target.value))}
            className="w-full bg-[#0d1117] border border-[#2a4a5e] rounded-md px-3 py-2 font-mono text-sm text-[#e0e6f0] mb-2 outline-none"
            placeholder="Stake £"
          />
          <div className="flex justify-between text-[11px] font-mono mb-1">
            <span className="text-[#5a6a7e]">ACCA ODDS</span>
            <span className="text-[#2a9d5c]">×{totalOdds.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono mb-3">
            <span className="text-[#5a6a7e]">EST. RETURN</span>
            <span className="text-[#2a9d5c]">£{estReturn}</span>
          </div>
          <a
            href="/slip"
            className="block w-full bg-gradient-to-r from-[#2a9d5c] to-[#1e7a47] text-white text-center font-['Rajdhani'] font-bold text-sm tracking-widest uppercase py-2 rounded-md"
          >
            View Full Slip
          </a>
        </div>
      )}
    </aside>
  )
}
