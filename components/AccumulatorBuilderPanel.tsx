'use client'
import type { CandidateSelection } from '@/types'

const CONFIDENCE_COLORS = {
  High: 'text-[#2a9d5c]',
  Medium: 'text-[#d4a017]',
  Low: 'text-[#e54242]',
}

interface Props {
  legs: CandidateSelection[]
  targetCount: number | null
  minMultiplier: number | null
  onRemove: (idx: number) => void
  aiSummary: string
  generatingSummary: boolean
  onGenerateSummary: () => void
  name: string
  onNameChange: (v: string) => void
  onSave: () => void
  saving: boolean
}

export function AccumulatorBuilderPanel({
  legs,
  targetCount,
  minMultiplier,
  onRemove,
  aiSummary,
  generatingSummary,
  onGenerateSummary,
  name,
  onNameChange,
  onSave,
  saving,
}: Props) {
  const totalOdds = legs.reduce((acc, l) => acc * l.odds, 1)
  const canGenerate = legs.length >= 2 && !generatingSummary
  const canSave = legs.length >= 2 && name.trim().length > 0 && !saving

  return (
    <div className="bg-[#0d1117] border border-[#1c2535] rounded-xl p-4 flex flex-col gap-4 sticky top-4">
      <div className="flex items-center justify-between">
        <h2 className="font-['Rajdhani'] text-base font-bold text-white tracking-widest uppercase">
          Builder
        </h2>
        {targetCount != null && (
          <span className="font-mono text-[10px] text-[#5a6a7e]">
            {legs.length}/{targetCount} legs
          </span>
        )}
      </div>

      {legs.length === 0 ? (
        <p className="font-mono text-[11px] text-[#3a4a5e] text-center py-6">
          Add selections from the results list.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {legs.map((leg, i) => (
            <div key={i} className="bg-[#060a0e] border border-[#1c2535] rounded-lg p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] text-[#4a5a6e] truncate">
                  {leg.homeTeam} vs {leg.awayTeam}
                </div>
                <div className="text-[12px] text-[#c0ccd8] font-medium mt-0.5">{leg.selection}</div>
                <div className="font-mono text-[10px] text-[#5a6a7e] uppercase tracking-wider">{leg.market}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-mono text-sm text-[#2a9d5c]">{leg.odds.toFixed(2)}</span>
                <span className={`font-mono text-[9px] uppercase ${CONFIDENCE_COLORS[leg.confidence]}`}>
                  {leg.confidence}
                </span>
              </div>
              <button
                onClick={() => onRemove(i)}
                className="text-[#3a4a5e] hover:text-[#e54242] transition-colors text-sm shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {legs.length >= 2 && (
        <div className="flex flex-col gap-1 border-t border-[#1c2535] pt-3">
          <div className="flex justify-between font-mono text-sm">
            <span className="text-[#5a6a7e]">Total Odds</span>
            <span className="text-[#2a9d5c] font-bold">×{totalOdds.toFixed(2)}</span>
          </div>
        </div>
      )}

      {minMultiplier !== null && legs.length > 0 && (
        <div className="flex justify-between font-mono text-[10px]">
          <span className="text-[#5a6a7e]">Min Target</span>
          <span className={totalOdds >= minMultiplier ? 'text-[#2a9d5c]' : 'text-[#e54242]'}>
            ×{minMultiplier.toFixed(2)} {totalOdds >= minMultiplier ? '✓' : '✗'}
          </span>
        </div>
      )}

      {aiSummary && (
        <div className="bg-[#060a0e] border border-[#1c2535] rounded-lg p-3 font-mono text-[11px] text-[#8a9ab0] leading-relaxed">
          {aiSummary}
        </div>
      )}

      <button
        onClick={onGenerateSummary}
        disabled={!canGenerate}
        className="w-full border border-[#2a4a5e] text-[#5a8ab0] font-['Rajdhani'] font-bold text-sm tracking-widest uppercase py-2 rounded-lg hover:bg-[#0a1a2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {generatingSummary ? 'Generating…' : aiSummary ? 'Regenerate AI Summary' : 'Generate AI Summary'}
      </button>

      <div className="flex flex-col gap-2 border-t border-[#1c2535] pt-3">
        <input
          type="text"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Name this accumulator…"
          className="w-full bg-[#060a0e] border border-[#2a4a5e] rounded-lg px-3 py-2 font-mono text-[12px] text-[#e0e6f0] outline-none focus:border-[#2a9d5c] placeholder-[#3a4a5e]"
        />
        <button
          onClick={onSave}
          disabled={!canSave}
          className="w-full bg-[#2a9d5c] text-[#060a0e] font-['Rajdhani'] font-bold text-sm tracking-widest uppercase py-2.5 rounded-lg hover:bg-[#22874d] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Accumulator'}
        </button>
      </div>
    </div>
  )
}
