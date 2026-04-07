'use client'
import { useState } from 'react'
import type { Report, BetSuggestion } from '@/types'

interface Props {
  report: Report | null
  matchId: string
}

const confidenceBars: Record<string, string> = {
  High: 'from-[#2a9d5c] to-[#4ecb7b]',
  Medium: 'from-[#e6a817] to-[#f0c040]',
  Low: 'from-[#e54242] to-[#ff6b6b]',
}

export function ReportPanel({ report: initialReport, matchId }: Props) {
  const [report, setReport] = useState<Report | null>(initialReport)
  const [generating, setGenerating] = useState(false)

  async function generateReport() {
    setGenerating(true)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, triggeredBy: 'manual' }),
      })
      if (res.ok) {
        const data = await res.json()
        setReport({
          id: '',
          match_id: matchId,
          content: data.report,
          generated_at: new Date().toISOString(),
          triggered_by: 'manual',
        })
      }
    } finally {
      setGenerating(false)
    }
  }

  async function addSuggestionToSlip(suggestion: BetSuggestion) {
    await fetch('/api/slip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId,
        market: suggestion.market,
        selection: suggestion.selection,
        odds: suggestion.odds,
        reportId: report?.id ?? null,
      }),
    })
    window.dispatchEvent(new Event('slip-updated'))
  }

  async function addAllToSlip() {
    if (!report) return
    for (const suggestion of report.content.suggestions) {
      await addSuggestionToSlip(suggestion)
    }
  }

  if (!report) {
    return (
      <div className="bg-[#0d1117] border border-[#1c2535] rounded-xl p-5 flex flex-col items-center gap-3">
        <p className="text-[#5a6a7e] font-mono text-sm">No report generated yet</p>
        <button
          onClick={generateReport}
          disabled={generating}
          className="bg-[#2a9d5c] text-white font-['Rajdhani'] font-bold text-sm tracking-widest uppercase px-5 py-2 rounded-lg disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate AI Report'}
        </button>
      </div>
    )
  }

  const c = report.content

  return (
    <div className="bg-[#0d1117] border border-[#1c2535] rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#1c2535] flex items-center justify-between">
        <span className="font-['Rajdhani'] font-bold text-white text-sm tracking-widest uppercase">
          AI Research Report
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#3a4a5e]">
            {new Date(report.generated_at).toLocaleString('en-GB')}
          </span>
          <button
            onClick={generateReport}
            disabled={generating}
            className="font-mono text-[10px] text-[#3a4a5e] hover:text-[#8a9ab0] border border-[#1c2535] rounded px-2 py-1 disabled:opacity-50"
          >
            {generating ? 'Regenerating...' : '↺ Regenerate'}
          </button>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Recent Form */}
        <section>
          <div className="font-mono text-[10px] text-[#2a9d5c] tracking-[0.1em] uppercase mb-2">Recent Form</div>
          {(['home', 'away'] as const).map(side => {
            const form = c.form[side]
            return (
              <div key={side} className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[10px] text-[#5a6a7e] w-16 shrink-0">
                  {side === 'home' ? 'Home' : 'Away'}
                </span>
                <div className="flex gap-1">
                  {(form.last_5_results ?? []).slice(0, 5).map((r: any, i: number) => {
                    const isWin = (side === 'home' && r.home_score > r.away_score) || (side === 'away' && r.away_score > r.home_score)
                    const isLoss = (side === 'home' && r.home_score < r.away_score) || (side === 'away' && r.away_score < r.home_score)
                    const letter = isWin ? 'W' : isLoss ? 'L' : 'D'
                    const cls = isWin ? 'bg-[#2a9d5c22] text-[#2a9d5c] border-[#2a9d5c44]' : isLoss ? 'bg-[#e5424222] text-[#e54242] border-[#e5424244]' : 'bg-[#e6a81722] text-[#e6a817] border-[#e6a81744]'
                    return (
                      <span key={i} className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-mono font-bold border ${cls}`}>
                        {letter}
                      </span>
                    )
                  })}
                </div>
                <span className="font-mono text-[10px] text-[#5a6a7e]">
                  {form.goals_scored_last5}GF · {form.goals_conceded_last5}GA
                </span>
              </div>
            )
          })}
        </section>

        {/* Key Insights */}
        {c.tactical_notes && (
          <section>
            <div className="font-mono text-[10px] text-[#2a9d5c] tracking-[0.1em] uppercase mb-2">Key Insights</div>
            <p className="text-[12px] text-[#8a9ab0] leading-relaxed">{c.tactical_notes}</p>
          </section>
        )}

        {/* Squad */}
        {(c.squad.home_injuries.length > 0 || c.squad.away_injuries.length > 0) && (
          <section>
            <div className="font-mono text-[10px] text-[#2a9d5c] tracking-[0.1em] uppercase mb-2">Injuries & Suspensions</div>
            <p className="text-[12px] text-[#8a9ab0]">
              Home: {c.squad.home_injuries.join(', ') || 'None'} ·{' '}
              Away: {c.squad.away_injuries.join(', ') || 'None'}
            </p>
          </section>
        )}

        {/* Suggestions */}
        <section>
          <div className="font-mono text-[10px] text-[#2a9d5c] tracking-[0.1em] uppercase mb-2">Betting Suggestions</div>
          <div className="flex flex-col gap-2">
            {c.suggestions.map((s, i) => (
              <div key={i} className="bg-[#060a0e] border border-[#1c2535] rounded-lg p-3 flex items-center gap-3">
                <div className={`w-1 h-8 rounded-sm bg-gradient-to-t ${confidenceBars[s.confidence] ?? confidenceBars.Medium} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-[#c0ccd8] font-medium mb-0.5">{s.label}</div>
                  <div className="text-[10px] text-[#4a5a6e] leading-tight">{s.reasoning}</div>
                </div>
                <div className="font-mono text-sm text-[#e0e6f0] font-medium shrink-0">{s.odds.toFixed(2)}</div>
                <button
                  onClick={() => addSuggestionToSlip(s)}
                  className="bg-[#2a9d5c] text-white font-mono text-[9px] font-medium tracking-widest px-2 py-1.5 rounded shrink-0"
                >
                  + SLIP
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="px-5 py-3 border-t border-[#1c2535] flex items-center justify-between">
        <span className="font-mono text-[10px] text-[#3a4a5e]">
          {c.suggestions.length} suggestions
        </span>
        <button
          onClick={addAllToSlip}
          className="font-mono text-[10px] text-[#2a9d5c] border border-[#2a9d5c] rounded px-3 py-1.5 hover:bg-[#2a9d5c18] transition-colors"
        >
          ＋ Add All to Slip
        </button>
      </div>
    </div>
  )
}
