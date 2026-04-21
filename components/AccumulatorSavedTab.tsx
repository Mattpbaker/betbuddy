'use client'
import { useState, useEffect } from 'react'
import type { Accumulator } from '@/types'

const CONFIDENCE_BADGE: Record<string, string> = {
  High: 'bg-[#2a9d5c18] text-[#2a9d5c] border-[#2a9d5c33]',
  Medium: 'bg-[#d4a01718] text-[#d4a017] border-[#d4a01733]',
  Low: 'bg-[#e5424218] text-[#e54242] border-[#e5424233]',
}

export function AccumulatorSavedTab() {
  const [accumulators, setAccumulators] = useState<Accumulator[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/accumulators')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load accumulators')
        return r.json()
      })
      .then(d => setAccumulators(d.accumulators ?? []))
      .catch(() => setFetchError('Failed to load saved accumulators.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    setDeletingId(id)
    const res = await fetch(`/api/accumulators/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setDeletingId(null)
      alert('Failed to delete. Please try again.')
      return
    }
    setAccumulators(prev => prev.filter(a => a.id !== id))
    setDeletingId(null)
  }

  function confidenceSummary(accu: Accumulator): string {
    const counts: Record<string, number> = {}
    for (const leg of accu.legs ?? []) {
      counts[leg.confidence] = (counts[leg.confidence] ?? 0) + 1
    }
    return (['High', 'Medium', 'Low'] as const)
      .filter(c => counts[c])
      .map(c => `${counts[c]} ${c}`)
      .join(', ')
  }

  if (loading) {
    return <div className="font-mono text-[11px] text-[#3a4a5e] py-10 text-center">Loading…</div>
  }

  if (fetchError) {
    return <div className="font-mono text-[11px] text-[#e54242] py-10 text-center">{fetchError}</div>
  }

  if (accumulators.length === 0) {
    return (
      <div className="font-mono text-[11px] text-[#3a4a5e] py-16 text-center">
        No saved accumulators yet. Use the Craft tab to build one.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {accumulators.map(accu => {
        const expanded = expandedId === accu.id
        const legCount = accu.legs?.length ?? 0
        const firstSentence = accu.ai_summary?.split('.')[0]

        return (
          <div key={accu.id} className="bg-[#0d1117] border border-[#1c2535] rounded-xl overflow-hidden">
            {/* Header row */}
            <div
              className="flex items-start gap-4 p-4 cursor-pointer hover:bg-[#0a0e13] transition-colors"
              onClick={() => setExpandedId(expanded ? null : accu.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-[#c0ccd8] font-medium mb-1">{accu.name}</div>
                <div className="font-mono text-[10px] text-[#5a6a7e]">
                  {legCount} leg{legCount !== 1 ? 's' : ''} · ×{accu.total_odds.toFixed(2)} · {confidenceSummary(accu)}
                </div>
                {firstSentence && (
                  <div className="font-mono text-[10px] text-[#4a5a6e] mt-1 italic truncate">
                    {firstSentence}.
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[10px] text-[#3a4a5e]">
                  {new Date(accu.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                <span className="font-mono text-[10px] text-[#5a6a7e]">{expanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded && (
              <div className="border-t border-[#1c2535] px-4 pb-4 pt-3 flex flex-col gap-3">
                {/* Legs table */}
                <div className="flex flex-col gap-2">
                  {(accu.legs ?? []).map(leg => (
                    <div key={leg.id} className="bg-[#060a0e] border border-[#1c2535] rounded-lg p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] text-[#4a5a6e]">
                          {leg.match?.home_team?.name} vs {leg.match?.away_team?.name}
                          {leg.match?.competition ? ` · ${leg.match.competition}` : ''}
                        </div>
                        <div className="text-[12px] text-[#c0ccd8] font-medium mt-0.5">{leg.selection}</div>
                        <div className="font-mono text-[10px] text-[#5a6a7e] uppercase tracking-wider">{leg.market}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono text-sm text-[#2a9d5c]">{leg.odds.toFixed(2)}</span>
                        <span className={`font-mono text-[9px] uppercase border px-1.5 py-0.5 rounded ${CONFIDENCE_BADGE[leg.confidence] ?? ''}`}>
                          {leg.confidence}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI summary */}
                {accu.ai_summary && (
                  <div className="bg-[#060a0e] border border-[#1c2535] rounded-lg p-3 font-mono text-[11px] text-[#8a9ab0] leading-relaxed">
                    {accu.ai_summary}
                  </div>
                )}

                {/* Delete */}
                <button
                  onClick={() => handleDelete(accu.id, accu.name)}
                  disabled={deletingId === accu.id}
                  className="self-start font-mono text-[10px] text-[#3a4a5e] hover:text-[#e54242] transition-colors disabled:opacity-40"
                >
                  {deletingId === accu.id ? 'Deleting…' : 'Delete accumulator'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
