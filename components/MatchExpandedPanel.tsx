'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { OddsPanel } from '@/components/OddsPanel'
import { ReportPanel } from '@/components/ReportPanel'
import type { Match, Report, Odd } from '@/types'

interface Props {
  matchId: string
  initialOdds: Odd[]
}

export function MatchExpandedPanel({ matchId, initialOdds }: Props) {
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<Report | null>(null)
  const [odds, setOdds] = useState<Odd[]>(initialOdds)

  useEffect(() => {
    fetch(`/api/matches/${matchId}`)
      .then(r => r.json())
      .then((data: Match) => {
        const r = Array.isArray(data.report)
          ? ((data.report[0] as Report) ?? null)
          : ((data.report as Report) ?? null)
        setReport(r)
        if (data.odds && data.odds.length > 0) setOdds(data.odds)
      })
      .finally(() => setLoading(false))
  }, [matchId])

  return (
    <div className="border-t border-[#1c2535] bg-[#060a0e]">
      {loading ? (
        <div className="py-8 text-center text-[#3a4a5e] font-mono text-[11px] animate-pulse">
          Loading...
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-5">
          <OddsPanel odds={odds} matchId={matchId} />
          <ReportPanel report={report} matchId={matchId} />
        </div>
      )}
      <div className="px-4 py-2.5 border-t border-[#1c2535] flex justify-end">
        <Link
          href={`/matches/${matchId}`}
          className="text-[10px] font-mono text-[#3a4a5e] hover:text-[#8a9ab0] transition-colors"
        >
          Open full page →
        </Link>
      </div>
    </div>
  )
}
