'use client'
import { useState, useMemo } from 'react'
import type { CandidateSelection } from '@/types'
import { AccumulatorBuilderPanel } from './AccumulatorBuilderPanel'

type Confidence = 'High' | 'Medium' | 'Low'

const CONFIDENCE_BADGE: Record<Confidence, string> = {
  High: 'bg-[#2a9d5c18] text-[#2a9d5c] border-[#2a9d5c33]',
  Medium: 'bg-[#d4a01718] text-[#d4a017] border-[#d4a01733]',
  Low: 'bg-[#e5424218] text-[#e54242] border-[#e5424233]',
}

export function AccumulatorCraftTab() {
  const [timeframe, setTimeframe] = useState<1 | 3>(1)
  const [numSelections, setNumSelections] = useState<string>('')
  const [minMultiplier, setMinMultiplier] = useState<string>('')
  const [minOdds, setMinOdds] = useState<string>('')
  const [maxOdds, setMaxOdds] = useState<string>('')
  const [riskRatings, setRiskRatings] = useState<Confidence[]>([])

  const [allCandidates, setAllCandidates] = useState<CandidateSelection[]>([])
  const [loading, setLoading] = useState(false)
  const [crafted, setCrafted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [legs, setLegs] = useState<CandidateSelection[]>([])
  const [aiSummary, setAiSummary] = useState('')
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  function toggleRisk(r: Confidence) {
    setRiskRatings(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    )
  }

  const filtered = useMemo(() => allCandidates.filter(c => {
    const min = minOdds ? parseFloat(minOdds) : null
    const max = maxOdds ? parseFloat(maxOdds) : null
    if (min !== null && c.odds < min) return false
    if (max !== null && c.odds > max) return false
    if (riskRatings.length > 0 && !riskRatings.includes(c.confidence)) return false
    return true
  }), [allCandidates, minOdds, maxOdds, riskRatings])

  async function handleCraft() {
    setLoading(true)
    setError(null)
    setCrafted(false)
    setAllCandidates([])
    setLegs([])
    setAiSummary('')

    try {
      const res = await fetch(`/api/accumulators/candidates?timeframe=${timeframe}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch candidates')
      setAllCandidates(data.candidates)
      setCrafted(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function addLeg(c: CandidateSelection) {
    const key = `${c.matchId}|${c.market}|${c.selection}`
    setLegs(prev => {
      if (prev.some(l => `${l.matchId}|${l.market}|${l.selection}` === key)) return prev
      return [...prev, c]
    })
    setAiSummary('')
  }

  function removeLeg(idx: number) {
    setLegs(prev => prev.filter((_, i) => i !== idx))
    setAiSummary('')
  }

  async function handleGenerateSummary() {
    setGeneratingSummary(true)
    try {
      const res = await fetch('/api/accumulators/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legs: legs.map(l => ({
            homeTeam: l.homeTeam,
            awayTeam: l.awayTeam,
            market: l.market,
            selection: l.selection,
            odds: l.odds,
            confidence: l.confidence,
            reasoning: l.reasoning,
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setAiSummary(data.summary)
      } else {
        setError(data.error ?? 'Failed to generate summary.')
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to generate summary.')
    } finally {
      setGeneratingSummary(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSavedMessage('')
    setSaveError(null)
    try {
      const totalOdds = legs.reduce((acc, l) => acc * l.odds, 1)
      const res = await fetch('/api/accumulators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          totalOdds: parseFloat(totalOdds.toFixed(2)),
          aiSummary: aiSummary || null,
          legs: legs.map(l => ({
            matchId: l.matchId,
            market: l.market,
            selection: l.selection,
            odds: l.odds,
            confidence: l.confidence,
            reportId: l.reportId,
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSavedMessage(`"${name.trim()}" saved!`)
        setLegs([])
        setName('')
        setAiSummary('')
      } else {
        setSaveError(data.error ?? 'Save failed. Please try again.')
      }
    } catch (e: any) {
      setSaveError(e.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const alreadyAddedKeys = useMemo(
    () => new Set(legs.map(l => `${l.matchId}|${l.market}|${l.selection}`)),
    [legs]
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Criteria form */}
      <div className="bg-[#0d1117] border border-[#1c2535] rounded-xl p-5">
        <h2 className="font-['Rajdhani'] text-base font-bold text-white tracking-widest uppercase mb-4">
          Bet Criteria
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          {/* Timeframe */}
          <div className="col-span-2 sm:col-span-3">
            <label className="font-mono text-[10px] text-[#5a6a7e] tracking-widest uppercase block mb-2">
              Timeframe
            </label>
            <div className="flex gap-2">
              {([1, 3] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setTimeframe(d)}
                  className={`px-4 py-1.5 rounded-lg font-mono text-[11px] tracking-wider border transition-colors ${
                    timeframe === d
                      ? 'bg-[#2a9d5c18] border-[#2a9d5c] text-[#2a9d5c]'
                      : 'border-[#1c2535] text-[#5a6a7e] hover:border-[#2a4a5e]'
                  }`}
                >
                  {d === 1 ? 'Next 24h' : 'Next 3 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Number of selections */}
          <div>
            <label className="font-mono text-[10px] text-[#5a6a7e] tracking-widest uppercase block mb-1.5">
              Target Legs
            </label>
            <input
              type="number"
              min={2}
              value={numSelections}
              onChange={e => setNumSelections(e.target.value)}
              placeholder="e.g. 4"
              className="w-full bg-[#060a0e] border border-[#2a4a5e] rounded-lg px-3 py-2 font-mono text-[12px] text-[#e0e6f0] outline-none focus:border-[#2a9d5c] placeholder-[#3a4a5e]"
            />
          </div>

          {/* Min total multiplier */}
          <div>
            <label className="font-mono text-[10px] text-[#5a6a7e] tracking-widest uppercase block mb-1.5">
              Min Multiplier
            </label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={minMultiplier}
              onChange={e => setMinMultiplier(e.target.value)}
              placeholder="e.g. 5.0"
              className="w-full bg-[#060a0e] border border-[#2a4a5e] rounded-lg px-3 py-2 font-mono text-[12px] text-[#e0e6f0] outline-none focus:border-[#2a9d5c] placeholder-[#3a4a5e]"
            />
          </div>

          {/* Min odds */}
          <div>
            <label className="font-mono text-[10px] text-[#5a6a7e] tracking-widest uppercase block mb-1.5">
              Min Odds
            </label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={minOdds}
              onChange={e => setMinOdds(e.target.value)}
              placeholder="e.g. 1.5"
              className="w-full bg-[#060a0e] border border-[#2a4a5e] rounded-lg px-3 py-2 font-mono text-[12px] text-[#e0e6f0] outline-none focus:border-[#2a9d5c] placeholder-[#3a4a5e]"
            />
          </div>

          {/* Max odds */}
          <div>
            <label className="font-mono text-[10px] text-[#5a6a7e] tracking-widest uppercase block mb-1.5">
              Max Odds
            </label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={maxOdds}
              onChange={e => setMaxOdds(e.target.value)}
              placeholder="e.g. 4.0"
              className="w-full bg-[#060a0e] border border-[#2a4a5e] rounded-lg px-3 py-2 font-mono text-[12px] text-[#e0e6f0] outline-none focus:border-[#2a9d5c] placeholder-[#3a4a5e]"
            />
          </div>
        </div>

        {/* Risk rating */}
        <div className="mb-5">
          <label className="font-mono text-[10px] text-[#5a6a7e] tracking-widest uppercase block mb-2">
            Risk Rating
          </label>
          <div className="flex gap-2">
            {(['High', 'Medium', 'Low'] as Confidence[]).map(r => (
              <button
                key={r}
                onClick={() => toggleRisk(r)}
                className={`px-3 py-1 rounded-lg font-mono text-[11px] border transition-colors ${
                  riskRatings.includes(r)
                    ? CONFIDENCE_BADGE[r]
                    : 'border-[#1c2535] text-[#5a6a7e] hover:border-[#2a4a5e]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCraft}
          disabled={loading}
          className="w-full bg-[#2a9d5c] text-[#060a0e] font-['Rajdhani'] font-bold text-sm tracking-widest uppercase py-3 rounded-lg hover:bg-[#22874d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching…' : 'Craft'}
        </button>

        {error && (
          <p className="font-mono text-[11px] text-[#e54242] mt-3">{error}</p>
        )}
      </div>

      {/* Results + builder */}
      {crafted && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Results list */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-['Rajdhani'] text-base font-bold text-white tracking-widest uppercase">
                Matching Selections
              </h2>
              <span className="font-mono text-[10px] text-[#5a6a7e]">{filtered.length} results</span>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-[#3a4a5e] font-mono text-sm">
                No selections match your criteria.
              </div>
            ) : (
              filtered.map((c) => {
                const key = `${c.matchId}|${c.market}|${c.selection}`
                const added = alreadyAddedKeys.has(key)
                return (
                  <div key={`${c.matchId}|${c.market}|${c.selection}`} className="bg-[#0d1117] border border-[#1c2535] rounded-lg p-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[10px] text-[#4a5a6e] mb-0.5">
                        {c.competition} · {new Date(c.matchDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </div>
                      <div className="font-mono text-[11px] text-[#6a7a8e] mb-1">
                        {c.homeTeam} vs {c.awayTeam}
                      </div>
                      <div className="text-[13px] text-[#c0ccd8] font-medium">{c.selection}</div>
                      <div className="font-mono text-[10px] text-[#5a6a7e] uppercase tracking-wider">{c.market}</div>
                      <div className="font-mono text-[10px] text-[#5a6a7e] mt-1 italic">{c.reasoning}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="font-mono text-base text-[#2a9d5c] font-medium">{c.odds.toFixed(2)}</span>
                      <span className={`font-mono text-[9px] uppercase border px-1.5 py-0.5 rounded ${CONFIDENCE_BADGE[c.confidence]}`}>
                        {c.confidence}
                      </span>
                      <button
                        onClick={() => addLeg(c)}
                        disabled={added}
                        className="font-mono text-[10px] tracking-wider px-2 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-[#2a9d5c] text-[#2a9d5c] hover:bg-[#2a9d5c18]"
                      >
                        {added ? 'Added' : '+ Add'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Builder panel */}
          <div>
            {savedMessage && (
              <div className="bg-[#2a9d5c18] border border-[#2a9d5c33] rounded-lg px-4 py-3 font-mono text-[11px] text-[#2a9d5c] mb-3">
                {savedMessage}
              </div>
            )}
            {saveError && (
              <p className="font-mono text-[11px] text-[#e54242] mb-2">{saveError}</p>
            )}
            <AccumulatorBuilderPanel
              legs={legs}
              targetCount={numSelections ? parseInt(numSelections, 10) : null}
              minMultiplier={minMultiplier ? parseFloat(minMultiplier) : null}
              onRemove={removeLeg}
              aiSummary={aiSummary}
              generatingSummary={generatingSummary}
              onGenerateSummary={handleGenerateSummary}
              name={name}
              onNameChange={setName}
              onSave={handleSave}
              saving={saving}
            />
          </div>
        </div>
      )}
    </div>
  )
}
