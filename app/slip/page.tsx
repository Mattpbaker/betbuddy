'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { BetSlip } from '@/types'

export default function SlipPage() {
  const [slip, setSlip] = useState<BetSlip | null>(null)
  const [stake, setStake] = useState(10)

  useEffect(() => {
    fetch('/api/slip')
      .then(r => r.json())
      .then(data => {
        setSlip(data)
        if (data.stake) setStake(data.stake)
      })
  }, [])

  async function removeItem(id: string) {
    await fetch(`/api/slip/${id}`, { method: 'DELETE' })
    setSlip(prev => prev ? { ...prev, items: prev.items?.filter(i => i.id !== id) } : null)
  }

  async function clearSlip() {
    await fetch('/api/slip', { method: 'DELETE' })
    setSlip(null)
  }

  const items = slip?.items ?? []
  const totalOdds = items.reduce((acc, item) => acc * item.odds, 1)
  const estReturn = (stake * totalOdds).toFixed(2)

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-['Rajdhani'] text-2xl font-bold text-white tracking-widest uppercase">
          Draft Bet Slip
        </h1>
        <Link href="/" className="font-mono text-[11px] text-[#5a6a7e] hover:text-[#8a9ab0]">
          ← Back to Matches
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 text-[#3a4a5e] font-mono text-sm">
          Your slip is empty. Add selections from the dashboard or match reports.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 mb-5">
            {items.map(item => (
              <div key={item.id} className="bg-[#0d1117] border border-[#1c2535] rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-[#4a5a6e] mb-1">
                    {item.match?.home_team?.name} vs {item.match?.away_team?.name}
                  </div>
                  <div className="text-[13px] text-[#c0ccd8] font-medium">{item.selection}</div>
                  <div className="font-mono text-[11px] text-[#5a6a7e] mt-0.5 uppercase tracking-wider">
                    {item.market}
                  </div>
                </div>
                <div className="font-mono text-lg text-[#2a9d5c] font-medium">{item.odds.toFixed(2)}</div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-[#3a4a5e] hover:text-[#e54242] transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="bg-[#0d1117] border border-[#1c2535] rounded-xl p-5">
            <div className="mb-4">
              <label className="font-mono text-[10px] text-[#5a6a7e] tracking-widest uppercase block mb-2">
                Stake
              </label>
              <input
                type="number"
                value={stake}
                onChange={e => setStake(Number(e.target.value))}
                className="w-full bg-[#060a0e] border border-[#2a4a5e] rounded-lg px-4 py-3 font-mono text-base text-[#e0e6f0] outline-none focus:border-[#2a9d5c]"
                placeholder="£ 10.00"
              />
            </div>

            <div className="flex flex-col gap-2 mb-5">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-[#5a6a7e]">Selections</span>
                <span className="text-[#c0ccd8]">{items.length}</span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span className="text-[#5a6a7e]">Accumulator Odds</span>
                <span className="text-[#2a9d5c]">×{totalOdds.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-mono text-sm border-t border-[#1c2535] pt-2 mt-1">
                <span className="text-[#8a9ab0] font-medium">Estimated Return</span>
                <span className="text-[#2a9d5c] text-base font-bold">£{estReturn}</span>
              </div>
            </div>

            <div className="text-[11px] text-[#3a4a5e] font-mono mb-4 bg-[#060a0e] rounded-lg p-3">
              ⚠ Indicative odds only. Actual returns may differ. Verify on your bookmaker before placing.
            </div>

            <button
              onClick={clearSlip}
              className="w-full border border-[#1c2535] text-[#5a6a7e] font-['Rajdhani'] font-bold text-sm tracking-widest uppercase py-2.5 rounded-lg hover:bg-[#1c2535] transition-colors"
            >
              Clear Slip
            </button>
          </div>
        </>
      )}
    </div>
  )
}
