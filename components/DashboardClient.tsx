'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MatchRow } from '@/components/MatchRow'
import type { Match } from '@/types'

const COMPETITION_ORDER = [
  'Champions League', 'Europa League', 'Conference League',
  'Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1',
  'FA Cup', 'Copa del Rey', 'DFB-Pokal', 'Coppa Italia', 'Coupe de France',
]

const COMPETITION_SHORT: Record<string, string> = {
  'Champions League': 'UCL', 'Europa League': 'UEL', 'Conference League': 'UECL',
  'Premier League': 'PL', 'La Liga': 'LaLiga', 'Bundesliga': 'BL',
  'Serie A': 'SA', 'Ligue 1': 'L1', 'FA Cup': 'FA Cup',
  'Copa del Rey': 'CDR', 'DFB-Pokal': 'DFB', 'Coppa Italia': 'CdI',
  'Coupe de France': 'CdF',
}

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P'])

type ViewMode = 'competition' | 'date'
type Tab = 'upcoming' | 'results'
type SyncKey = 'fixtures' | 'odds' | 'rich'

function getDateLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z')
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setUTCDate(today.getUTCDate() + 1)
  const todayStr = today.toISOString().slice(0, 10)
  const tomStr = tomorrow.toISOString().slice(0, 10)
  if (isoDate === todayStr) return 'Today'
  if (isoDate === tomStr) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

interface Props {
  initialMatches: Match[]
}

export function DashboardClient({ initialMatches }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [results, setResults] = useState<Match[] | null>(null)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [syncing, setSyncing] = useState<Partial<Record<SyncKey, boolean>>>({})
  const [syncStatus, setSyncStatus] = useState<Partial<Record<SyncKey, string>>>({})
  const [viewMode, setViewMode] = useState<ViewMode>('competition')
  const [filterComp, setFilterComp] = useState<string | null>(null)
  const [filterHasOdds, setFilterHasOdds] = useState(false)
  const [filterHasReport, setFilterHasReport] = useState(false)

  const hasLive = initialMatches.some(m => LIVE_STATUSES.has(m.status))

  function switchTab(t: Tab) {
    setTab(t)
    setFilterComp(null)
    if (t === 'results' && results === null) {
      setResultsLoading(true)
      fetch('/api/matches/results')
        .then(r => r.json())
        .then((data: Match[]) => setResults(data))
        .finally(() => setResultsLoading(false))
    }
  }

  // Auto-refresh every 60s when there are live matches
  useEffect(() => {
    if (!hasLive) return
    const id = setInterval(() => router.refresh(), 60_000)
    return () => clearInterval(id)
  }, [hasLive, router])

  async function runSync(key: SyncKey) {
    setSyncing(s => ({ ...s, [key]: true }))
    setSyncStatus(s => ({ ...s, [key]: '' }))
    try {
      const res = await fetch(`/api/sync/${key}`, { method: 'POST' })
      const data = await res.json()
      const msg = data.upserted !== undefined ? `✓ ${data.upserted}` : data.synced !== undefined ? `✓ ${data.synced}` : '✓'
      setSyncStatus(s => ({ ...s, [key]: msg }))
      router.refresh()
      setTimeout(() => setSyncStatus(s => ({ ...s, [key]: '' })), 4000)
    } catch {
      setSyncStatus(s => ({ ...s, [key]: '✗' }))
    } finally {
      setSyncing(s => ({ ...s, [key]: false }))
    }
  }

  const activeMatches = tab === 'results' ? (results ?? []) : initialMatches

  // Build sorted competition list
  const allCompetitions = [...new Set(activeMatches.map(m => m.competition))].sort((a, b) => {
    const ai = COMPETITION_ORDER.indexOf(a)
    const bi = COMPETITION_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  // Apply filters
  let filtered = activeMatches
  if (filterComp) filtered = filtered.filter(m => m.competition === filterComp)
  if (filterHasOdds) filtered = filtered.filter(m => (m.odds?.length ?? 0) > 0)
  if (filterHasReport) filtered = filtered.filter(m => {
    const r = m.report
    return Array.isArray(r) ? r.length > 0 : !!r
  })

  // Build grouped sections
  const groups: { key: string; label: string; count: string; matches: Match[]; hasLive: boolean }[] = []

  if (viewMode === 'competition') {
    for (const comp of allCompetitions) {
      const ms = filtered.filter(m => m.competition === comp)
      if (ms.length === 0) continue
      groups.push({
        key: comp,
        label: comp,
        count: `${ms.length} match${ms.length !== 1 ? 'es' : ''}`,
        matches: ms,
        hasLive: ms.some(m => LIVE_STATUSES.has(m.status)),
      })
    }
  } else {
    const dateMap = new Map<string, Match[]>()
    for (const m of filtered) {
      const dk = m.match_date.slice(0, 10)
      if (!dateMap.has(dk)) dateMap.set(dk, [])
      dateMap.get(dk)!.push(m)
    }
    const sortedEntries = [...dateMap.entries()].sort(([a], [b]) =>
      tab === 'results' ? b.localeCompare(a) : a.localeCompare(b)
    )
    for (const [dk, ms] of sortedEntries) {
      const sorted = ms.sort((a, b) => a.match_date.localeCompare(b.match_date))
      groups.push({
        key: dk,
        label: getDateLabel(dk),
        count: `${ms.length} match${ms.length !== 1 ? 'es' : ''}`,
        matches: sorted,
        hasLive: sorted.some(m => LIVE_STATUSES.has(m.status)),
      })
    }
  }

  const syncButtons: { key: SyncKey; label: string; title: string }[] = [
    { key: 'fixtures', label: 'FIXTURES', title: 'Sync upcoming fixtures & live scores' },
    { key: 'odds', label: 'ODDS', title: 'Sync betting odds for upcoming matches' },
    { key: 'rich', label: 'RICH DATA', title: 'Sync lineups & predictions for AI reports' },
  ]

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="font-['Rajdhani'] text-2xl font-bold text-white tracking-widest uppercase flex items-center gap-2">
            {hasLive && tab === 'upcoming' && <span className="text-[#ff4444] animate-pulse text-lg">●</span>}
            Matches
            {hasLive && tab === 'upcoming' && (
              <span className="text-[10px] font-mono text-[#ff4444] border border-[#ff444430] bg-[#ff444410] px-2 py-0.5 rounded-full normal-case tracking-normal">
                LIVE NOW
              </span>
            )}
          </h1>
          {/* Tab switcher */}
          <div className="flex bg-[#0d1117] border border-[#1c2535] rounded-md overflow-hidden">
            {(['upcoming', 'results'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`px-3 py-1 text-[10px] font-mono tracking-wider transition-colors ${
                  tab === t ? 'bg-[#1c2535] text-[#c0ccd8]' : 'text-[#3a4a5e] hover:text-[#8a9ab0]'
                }`}
              >
                {t === 'upcoming' ? 'UPCOMING' : 'RESULTS'}
              </button>
            ))}
          </div>
        </div>

        {/* Sync buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-[#3a4a5e] uppercase tracking-widest mr-1 hidden sm:block">SYNC</span>
          {syncButtons.map(({ key, label, title }) => (
            <button
              key={key}
              onClick={() => runSync(key)}
              disabled={!!syncing[key]}
              title={title}
              className={`text-[9px] font-mono tracking-widest border rounded px-2.5 py-1.5 transition-all disabled:cursor-not-allowed min-w-[64px] text-center
                ${syncStatus[key]?.startsWith('✓')
                  ? 'border-[#2a9d5c44] bg-[#2a9d5c18] text-[#2a9d5c]'
                  : syncStatus[key]?.startsWith('✗')
                    ? 'border-[#e5424230] bg-[#e5424210] text-[#e54242]'
                    : 'border-[#1c2535] text-[#5a6a7e] hover:text-[#8a9ab0] hover:bg-[#1c2535]'
                }
                ${syncing[key] ? 'opacity-60' : ''}`}
            >
              {syncing[key] ? (
                <span className="inline-block animate-spin">↻</span>
              ) : syncStatus[key] ? (
                syncStatus[key]
              ) : (
                label
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* View toggle */}
        <div className="flex bg-[#0d1117] border border-[#1c2535] rounded-md overflow-hidden shrink-0">
          {(['competition', 'date'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-[10px] font-mono tracking-wider transition-colors ${
                viewMode === mode ? 'bg-[#1c2535] text-[#c0ccd8]' : 'text-[#3a4a5e] hover:text-[#8a9ab0]'
              }`}
            >
              {mode === 'competition' ? 'BY LEAGUE' : 'BY DATE'}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-[#1c2535] hidden sm:block" />

        {/* Competition pills */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilterComp(null)}
            className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors ${
              !filterComp ? 'border-[#2a9d5c44] bg-[#2a9d5c18] text-[#2a9d5c]' : 'border-[#1c2535] text-[#3a4a5e] hover:text-[#8a9ab0]'
            }`}
          >
            ALL
          </button>
          {allCompetitions.map(comp => (
            <button
              key={comp}
              onClick={() => setFilterComp(filterComp === comp ? null : comp)}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors ${
                filterComp === comp ? 'border-[#2a9d5c44] bg-[#2a9d5c18] text-[#2a9d5c]' : 'border-[#1c2535] text-[#3a4a5e] hover:text-[#8a9ab0]'
              }`}
            >
              {COMPETITION_SHORT[comp] ?? comp}
            </button>
          ))}
        </div>

        {/* Right-side toggles */}
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setFilterHasOdds(v => !v)}
            className={`px-2.5 py-1 text-[9px] font-mono rounded border transition-colors ${
              filterHasOdds ? 'border-[#2a9d5c44] bg-[#2a9d5c18] text-[#2a9d5c]' : 'border-[#1c2535] text-[#3a4a5e] hover:text-[#8a9ab0]'
            }`}
          >
            HAS ODDS
          </button>
          <button
            onClick={() => setFilterHasReport(v => !v)}
            className={`px-2.5 py-1 text-[9px] font-mono rounded border transition-colors ${
              filterHasReport ? 'border-[#2a9d5c44] bg-[#2a9d5c18] text-[#2a9d5c]' : 'border-[#1c2535] text-[#3a4a5e] hover:text-[#8a9ab0]'
            }`}
          >
            AI READY
          </button>
        </div>
      </div>

      {/* Match list */}
      {resultsLoading ? (
        <div className="text-center py-20 text-[#3a4a5e] font-mono text-sm animate-pulse">
          Loading results...
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-[#3a4a5e] font-mono text-sm">
          {tab === 'results' ? 'No results in the last 7 days.' : 'No matches found.'}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(({ key, label, count, matches: gms, hasLive: gl }) => (
            <section key={key}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${gl ? 'bg-[#ff4444] animate-pulse' : 'bg-[#2a9d5c]'}`} />
                <h2 className="font-mono text-[11px] text-[#5a6a7e] tracking-[0.1em] uppercase">
                  {label} · {count}
                </h2>
              </div>
              <div className="bg-[#0d1117] border border-[#1c2535] rounded-lg overflow-hidden">
                {gms.map(match => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    showCompetition={viewMode === 'date'}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
