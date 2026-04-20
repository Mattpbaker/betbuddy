# Accumulator Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `/accumulators` page where the user sets bet criteria, searches for qualifying AI report suggestions, hand-picks legs into a draft builder panel, generates an AI narrative, and saves named accumulators.

**Architecture:** Client fetches all match+report candidates for a chosen timeframe from a new API route; all suggestion-level filtering (odds, confidence) runs in the browser for instant response. Saved accumulators live in two new Supabase tables (`accumulators`, `accumulator_legs`) behind a small REST layer.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Supabase (supabaseAdmin service key), Anthropic claude-sonnet-4-6, Jest

---

## File Map

**New files:**
- `types/index.ts` — add `CandidateSelection`, `AccumulatorLeg`, `Accumulator` types
- `app/api/accumulators/candidates/route.ts` — GET: fetch matches+reports for timeframe
- `app/api/accumulators/summary/route.ts` — POST: Claude AI narrative for selected legs
- `app/api/accumulators/route.ts` — GET: list saved; POST: save new
- `app/api/accumulators/[id]/route.ts` — DELETE: remove accumulator
- `app/accumulators/page.tsx` — server component shell with tab state
- `components/AccumulatorCraftTab.tsx` — criteria form + results list + builder panel
- `components/AccumulatorBuilderPanel.tsx` — right-side draft builder
- `components/AccumulatorSavedTab.tsx` — saved list with expand/collapse
- `__tests__/api/accumulators-candidates.test.ts`
- `__tests__/api/accumulators-summary.test.ts`
- `__tests__/api/accumulators-crud.test.ts`

**Modified files:**
- `components/layout/Sidebar.tsx` — add Accumulators nav item
- `supabase/schema.sql` — append new tables

---

## Task 1: Add TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add new types to the end of types/index.ts**

Open `types/index.ts` and append after the last interface:

```typescript
export interface CandidateSelection {
  matchId: string
  matchDate: string
  competition: string
  homeTeam: string
  awayTeam: string
  reportId: string
  label: string
  market: string
  selection: string
  odds: number
  confidence: 'High' | 'Medium' | 'Low'
  reasoning: string
}

export interface AccumulatorLeg {
  id: string
  accumulator_id: string
  match_id: string
  market: string
  selection: string
  odds: number
  confidence: 'High' | 'Medium' | 'Low'
  report_id: string | null
  match?: {
    match_date: string
    competition: string
    home_team: { name: string }
    away_team: { name: string }
  }
}

export interface Accumulator {
  id: string
  name: string
  total_odds: number
  ai_summary: string | null
  created_at: string
  legs?: AccumulatorLeg[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mattbaker/Projects/Betbuddy && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add CandidateSelection, AccumulatorLeg, Accumulator types"
```

---

## Task 2: Database Schema

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Append new tables to supabase/schema.sql**

Open `supabase/schema.sql` and append at the end:

```sql
-- Accumulator builder: saved named accumulators
create table if not exists accumulators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_odds numeric(8,2) not null,
  ai_summary text,
  created_at timestamptz not null default now()
);

-- Individual legs of a saved accumulator
create table if not exists accumulator_legs (
  id uuid primary key default gen_random_uuid(),
  accumulator_id uuid not null references accumulators(id) on delete cascade,
  match_id uuid not null references matches(id),
  market text not null,
  selection text not null,
  odds numeric(6,2) not null,
  confidence text not null check (confidence in ('High', 'Medium', 'Low')),
  report_id uuid references reports(id)
);
```

- [ ] **Step 2: Run migration in Supabase**

Go to your Supabase project → SQL Editor → New query. Paste and run:

```sql
create table if not exists accumulators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_odds numeric(8,2) not null,
  ai_summary text,
  created_at timestamptz not null default now()
);

create table if not exists accumulator_legs (
  id uuid primary key default gen_random_uuid(),
  accumulator_id uuid not null references accumulators(id) on delete cascade,
  match_id uuid not null references matches(id),
  market text not null,
  selection text not null,
  odds numeric(6,2) not null,
  confidence text not null check (confidence in ('High', 'Medium', 'Low')),
  report_id uuid references reports(id)
);
```

Expected: "Success. No rows returned."

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add accumulators and accumulator_legs schema tables"
```

---

## Task 3: Candidates API Route

**Files:**
- Create: `app/api/accumulators/candidates/route.ts`
- Create: `__tests__/api/accumulators-candidates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/accumulators-candidates.test.ts`:

```typescript
// __tests__/api/accumulators-candidates.test.ts
import { GET } from '@/app/api/accumulators/candidates/route'

const mockMatches = [
  {
    id: 'match-1',
    match_date: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    competition: 'Premier League',
    status: 'NS',
    home_team: { name: 'Arsenal' },
    away_team: { name: 'Chelsea' },
    report: [
      {
        id: 'report-1',
        content: {
          suggestions: [
            { label: 'Home Win', market: 'Match Winner', selection: 'Home', odds: 1.9, confidence: 'High', reasoning: 'Strong home form' },
            { label: 'BTTS', market: 'Both Teams Score', selection: 'Yes', odds: 1.7, confidence: 'Medium', reasoning: 'Both score often' },
          ],
        },
      },
    ],
  },
  {
    id: 'match-2',
    match_date: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    competition: 'La Liga',
    status: 'NS',
    home_team: { name: 'Barcelona' },
    away_team: { name: 'Real Madrid' },
    report: [], // no report — should be excluded
  },
]

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: mockMatches, error: null }),
  },
}))

describe('GET /api/accumulators/candidates', () => {
  it('returns 400 when timeframe is invalid', async () => {
    const req = new Request('http://localhost/api/accumulators/candidates?timeframe=7')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns only candidates from matches that have reports with suggestions', async () => {
    const req = new Request('http://localhost/api/accumulators/candidates?timeframe=1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.candidates).toHaveLength(2)
    expect(body.candidates[0].matchId).toBe('match-1')
    expect(body.candidates[0].homeTeam).toBe('Arsenal')
    expect(body.candidates[0].market).toBe('Match Winner')
    expect(body.candidates[1].market).toBe('Both Teams Score')
  })

  it('defaults to timeframe=1 when not provided', async () => {
    const req = new Request('http://localhost/api/accumulators/candidates')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/mattbaker/Projects/Betbuddy && npx jest __tests__/api/accumulators-candidates.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/app/api/accumulators/candidates/route'"

- [ ] **Step 3: Create the candidates API route**

Create `app/api/accumulators/candidates/route.ts`:

```typescript
// app/api/accumulators/candidates/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { CandidateSelection } from '@/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawTimeframe = searchParams.get('timeframe') ?? '1'
  const days = parseInt(rawTimeframe, 10)

  if (days !== 1 && days !== 3) {
    return NextResponse.json({ error: 'timeframe must be 1 or 3' }, { status: 400 })
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const { data: matches, error } = await supabaseAdmin
    .from('matches')
    .select(`
      id, match_date, competition, status,
      home_team:home_team_id(name),
      away_team:away_team_id(name),
      report:reports!match_id(id, content)
    `)
    .gte('match_date', now.toISOString())
    .lte('match_date', cutoff.toISOString())
    .in('status', ['NS', 'TBD'])
    .order('match_date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const candidates: CandidateSelection[] = []

  for (const match of matches ?? []) {
    const reportArr = Array.isArray(match.report) ? match.report : match.report ? [match.report] : []
    const report = reportArr[0]
    if (!report?.content?.suggestions?.length) continue

    const homeTeam = (match.home_team as any)?.name ?? ''
    const awayTeam = (match.away_team as any)?.name ?? ''

    for (const s of report.content.suggestions) {
      candidates.push({
        matchId: match.id,
        matchDate: match.match_date,
        competition: match.competition,
        homeTeam,
        awayTeam,
        reportId: report.id,
        label: s.label,
        market: s.market,
        selection: s.selection,
        odds: s.odds,
        confidence: s.confidence,
        reasoning: s.reasoning,
      })
    }
  }

  return NextResponse.json({ candidates })
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx jest __tests__/api/accumulators-candidates.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/accumulators/candidates/route.ts __tests__/api/accumulators-candidates.test.ts
git commit -m "feat: add GET /api/accumulators/candidates route"
```

---

## Task 4: Summary API Route

**Files:**
- Create: `app/api/accumulators/summary/route.ts`
- Create: `__tests__/api/accumulators-summary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/accumulators-summary.test.ts`:

```typescript
// __tests__/api/accumulators-summary.test.ts
import { POST } from '@/app/api/accumulators/summary/route'

jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'This is a solid low-risk double. Both selections are well-supported by recent form.' }],
        }),
      },
    })),
  }
})

const legs = [
  { homeTeam: 'Arsenal', awayTeam: 'Chelsea', market: 'Match Winner', selection: 'Home', odds: 1.9, confidence: 'High', reasoning: 'Strong home form' },
  { homeTeam: 'Barcelona', awayTeam: 'Real Madrid', market: 'Both Teams Score', selection: 'Yes', odds: 1.7, confidence: 'Medium', reasoning: 'Both attack well' },
]

describe('POST /api/accumulators/summary', () => {
  it('returns 400 when legs are missing', async () => {
    const req = new Request('http://localhost/api/accumulators/summary', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when fewer than 2 legs provided', async () => {
    const req = new Request('http://localhost/api/accumulators/summary', {
      method: 'POST',
      body: JSON.stringify({ legs: [legs[0]] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns AI summary text for valid legs', async () => {
    const req = new Request('http://localhost/api/accumulators/summary', {
      method: 'POST',
      body: JSON.stringify({ legs }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.summary).toBe('string')
    expect(body.summary.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx jest __tests__/api/accumulators-summary.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/app/api/accumulators/summary/route'"

- [ ] **Step 3: Create the summary API route**

Create `app/api/accumulators/summary/route.ts`:

```typescript
// app/api/accumulators/summary/route.ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

interface LegInput {
  homeTeam: string
  awayTeam: string
  market: string
  selection: string
  odds: number
  confidence: string
  reasoning: string
}

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

export async function POST(req: Request) {
  try {
    const { legs } = await req.json() as { legs?: LegInput[] }

    if (!legs || !Array.isArray(legs) || legs.length < 2) {
      return NextResponse.json({ error: 'At least 2 legs required' }, { status: 400 })
    }

    const legLines = legs.map((l, i) =>
      `${i + 1}. ${l.homeTeam} vs ${l.awayTeam} — ${l.market}: ${l.selection} @ ${l.odds} (${l.confidence} confidence)\n   Reasoning: ${l.reasoning}`
    ).join('\n')

    const prompt = `You are a football betting analyst. Review the following accumulator and write a concise assessment in 150-200 words.

Cover:
- Whether the legs complement each other (same day, injury risk, value)
- Overall risk profile of the combined bet
- Key factors to monitor before placing
- A brief verdict (e.g. "solid low-risk double", "high-reward but volatile treble")

Selected legs:
${legLines}

Write plain text only. No markdown headers. No bullet points. Just flowing prose.`

    const client = getClient()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Summary generation error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx jest __tests__/api/accumulators-summary.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/accumulators/summary/route.ts __tests__/api/accumulators-summary.test.ts
git commit -m "feat: add POST /api/accumulators/summary AI narrative route"
```

---

## Task 5: Save & List API Route

**Files:**
- Create: `app/api/accumulators/route.ts`
- Create: `__tests__/api/accumulators-crud.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/accumulators-crud.test.ts`:

```typescript
// __tests__/api/accumulators-crud.test.ts
import { GET, POST } from '@/app/api/accumulators/route'

const mockAccumulators = [
  {
    id: 'accu-1',
    name: 'Weekend Double',
    total_odds: 3.23,
    ai_summary: 'A solid low-risk double.',
    created_at: '2026-04-20T10:00:00Z',
    legs: [
      {
        id: 'leg-1',
        accumulator_id: 'accu-1',
        match_id: 'match-1',
        market: 'Match Winner',
        selection: 'Home',
        odds: 1.9,
        confidence: 'High',
        report_id: null,
        match: { match_date: '2026-04-21T15:00:00Z', competition: 'Premier League', home_team: { name: 'Arsenal' }, away_team: { name: 'Chelsea' } },
      },
    ],
  },
]

const mockInsertAccu = { data: { id: 'accu-new' }, error: null }
const mockInsertLegs = { error: null }

const mockFrom = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...args: any[]) => mockFrom(...args) },
}))

describe('GET /api/accumulators', () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: mockAccumulators, error: null }),
    })
  })

  it('returns list of saved accumulators with legs', async () => {
    const req = new Request('http://localhost/api/accumulators')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accumulators).toHaveLength(1)
    expect(body.accumulators[0].name).toBe('Weekend Double')
    expect(body.accumulators[0].legs).toHaveLength(1)
  })
})

describe('POST /api/accumulators', () => {
  beforeEach(() => {
    mockFrom
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(mockInsertAccu),
      })
      .mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue(mockInsertLegs),
      })
  })

  it('returns 400 when required fields are missing', async () => {
    const req = new Request('http://localhost/api/accumulators', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('saves accumulator and legs, returns id', async () => {
    const req = new Request('http://localhost/api/accumulators', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Weekend Double',
        totalOdds: 3.23,
        aiSummary: 'Solid double.',
        legs: [
          { matchId: 'match-1', market: 'Match Winner', selection: 'Home', odds: 1.9, confidence: 'High', reportId: null },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('accu-new')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx jest __tests__/api/accumulators-crud.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '@/app/api/accumulators/route'"

- [ ] **Step 3: Create the accumulators route**

Create `app/api/accumulators/route.ts`:

```typescript
// app/api/accumulators/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: Request) {
  const { data, error } = await supabaseAdmin
    .from('accumulators')
    .select(`
      id, name, total_odds, ai_summary, created_at,
      legs:accumulator_legs(
        id, market, selection, odds, confidence, report_id,
        match:match_id(match_date, competition, home_team:home_team_id(name), away_team:away_team_id(name))
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accumulators: data ?? [] })
}

interface LegInput {
  matchId: string
  market: string
  selection: string
  odds: number
  confidence: 'High' | 'Medium' | 'Low'
  reportId: string | null
}

export async function POST(req: Request) {
  try {
    const { name, totalOdds, aiSummary, legs } = await req.json() as {
      name?: string
      totalOdds?: number
      aiSummary?: string | null
      legs?: LegInput[]
    }

    if (!name || totalOdds == null || !legs?.length) {
      return NextResponse.json({ error: 'name, totalOdds, and legs are required' }, { status: 400 })
    }

    const { data: accu, error: accuError } = await supabaseAdmin
      .from('accumulators')
      .insert({ name, total_odds: totalOdds, ai_summary: aiSummary ?? null })
      .select('id')
      .single()

    if (accuError || !accu) {
      return NextResponse.json({ error: accuError?.message ?? 'Insert failed' }, { status: 500 })
    }

    const { error: legsError } = await supabaseAdmin
      .from('accumulator_legs')
      .insert(
        legs.map(l => ({
          accumulator_id: accu.id,
          match_id: l.matchId,
          market: l.market,
          selection: l.selection,
          odds: l.odds,
          confidence: l.confidence,
          report_id: l.reportId ?? null,
        }))
      )

    if (legsError) return NextResponse.json({ error: legsError.message }, { status: 500 })

    return NextResponse.json({ id: accu.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx jest __tests__/api/accumulators-crud.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/accumulators/route.ts __tests__/api/accumulators-crud.test.ts
git commit -m "feat: add GET+POST /api/accumulators route"
```

---

## Task 6: Delete API Route

**Files:**
- Create: `app/api/accumulators/[id]/route.ts`

(No separate test file needed — the cascade delete is a single DB call; add a test case to `accumulators-crud.test.ts` if desired, but the logic is trivial enough that a compilation check suffices.)

- [ ] **Step 1: Create the delete route**

Create `app/api/accumulators/[id]/route.ts`:

```typescript
// app/api/accumulators/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { error } = await supabaseAdmin
    .from('accumulators')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/accumulators/[id]/route.ts
git commit -m "feat: add DELETE /api/accumulators/[id] route"
```

---

## Task 7: AccumulatorBuilderPanel Component

**Files:**
- Create: `components/AccumulatorBuilderPanel.tsx`

This is the right-side panel: selected legs, running multiplier, name input, AI summary, generate and save buttons.

- [ ] **Step 1: Create the component**

Create `components/AccumulatorBuilderPanel.tsx`:

```typescript
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
          {minMultiplier !== null && (
            <div className="flex justify-between font-mono text-[10px]">
              <span className="text-[#5a6a7e]">Min Target</span>
              <span className={totalOdds >= minMultiplier ? 'text-[#2a9d5c]' : 'text-[#e54242]'}>
                ×{minMultiplier.toFixed(2)} {totalOdds >= minMultiplier ? '✓' : '✗'}
              </span>
            </div>
          )}
        </div>
      )}

      {aiSummary && (
        <div className="bg-[#060a0e] border border-[#1c2535] rounded-lg p-3 font-mono text-[11px] text-[#8a9ab0] leading-relaxed">
          {aiSummary}
        </div>
      )}

      {legs.length >= 2 && (
        <button
          onClick={onGenerateSummary}
          disabled={!canGenerate}
          className="w-full border border-[#2a4a5e] text-[#5a8ab0] font-['Rajdhani'] font-bold text-sm tracking-widest uppercase py-2 rounded-lg hover:bg-[#0a1a2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {generatingSummary ? 'Generating…' : aiSummary ? 'Regenerate AI Summary' : 'Generate AI Summary'}
        </button>
      )}

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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AccumulatorBuilderPanel.tsx
git commit -m "feat: add AccumulatorBuilderPanel component"
```

---

## Task 8: AccumulatorCraftTab Component

**Files:**
- Create: `components/AccumulatorCraftTab.tsx`

This is the main interactive component: criteria form, results list, and builder panel side-by-side.

- [ ] **Step 1: Create the component**

Create `components/AccumulatorCraftTab.tsx`:

```typescript
'use client'
import { useState } from 'react'
import type { CandidateSelection } from '@/types'
import { AccumulatorBuilderPanel } from './AccumulatorBuilderPanel'

type Confidence = 'High' | 'Medium' | 'Low'

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  High: 'text-[#2a9d5c]',
  Medium: 'text-[#d4a017]',
  Low: 'text-[#e54242]',
}

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

  function toggleRisk(r: Confidence) {
    setRiskRatings(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    )
  }

  const filtered = allCandidates.filter(c => {
    const min = minOdds ? parseFloat(minOdds) : null
    const max = maxOdds ? parseFloat(maxOdds) : null
    if (min !== null && c.odds < min) return false
    if (max !== null && c.odds > max) return false
    if (riskRatings.length > 0 && !riskRatings.includes(c.confidence)) return false
    return true
  })

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
    setLegs(prev => [...prev, c])
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
      if (res.ok) setAiSummary(data.summary)
    } finally {
      setGeneratingSummary(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSavedMessage('')
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
      if (res.ok) {
        setSavedMessage(`"${name.trim()}" saved!`)
        setLegs([])
        setName('')
        setAiSummary('')
      }
    } finally {
      setSaving(false)
    }
  }

  const alreadyAddedKeys = new Set(legs.map(l => `${l.matchId}|${l.market}|${l.selection}`))

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
              filtered.map((c, i) => {
                const key = `${c.matchId}|${c.market}|${c.selection}`
                const added = alreadyAddedKeys.has(key)
                return (
                  <div key={i} className="bg-[#0d1117] border border-[#1c2535] rounded-lg p-4 flex items-start gap-4">
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AccumulatorCraftTab.tsx
git commit -m "feat: add AccumulatorCraftTab component"
```

---

## Task 9: AccumulatorSavedTab Component

**Files:**
- Create: `components/AccumulatorSavedTab.tsx`

- [ ] **Step 1: Create the component**

Create `components/AccumulatorSavedTab.tsx`:

```typescript
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/accumulators')
      .then(r => r.json())
      .then(d => setAccumulators(d.accumulators ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    setDeletingId(id)
    await fetch(`/api/accumulators/${id}`, { method: 'DELETE' })
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AccumulatorSavedTab.tsx
git commit -m "feat: add AccumulatorSavedTab component"
```

---

## Task 10: Accumulators Page

**Files:**
- Create: `app/accumulators/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/accumulators/page.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { AccumulatorCraftTab } from '@/components/AccumulatorCraftTab'
import { AccumulatorSavedTab } from '@/components/AccumulatorSavedTab'

type Tab = 'craft' | 'saved'

export default function AccumulatorsPage() {
  const [tab, setTab] = useState<Tab>('craft')

  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-['Rajdhani'] text-2xl font-bold text-white tracking-widest uppercase">
          Accumulator Builder
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#0d1117] border border-[#1c2535] rounded-lg p-1 w-fit">
        {(['craft', 'saved'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-1.5 rounded-md font-['Rajdhani'] font-bold text-sm tracking-widest uppercase transition-colors ${
              tab === t
                ? 'bg-[#2a9d5c18] text-[#2a9d5c]'
                : 'text-[#5a6a7e] hover:text-[#8a9ab0]'
            }`}
          >
            {t === 'craft' ? 'Craft' : 'Saved'}
          </button>
        ))}
      </div>

      {tab === 'craft' ? <AccumulatorCraftTab /> : <AccumulatorSavedTab />}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/accumulators/page.tsx
git commit -m "feat: add /accumulators page with Craft/Saved tabs"
```

---

## Task 11: Add Sidebar Navigation Link

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Accumulators to the navItems array**

In `components/layout/Sidebar.tsx`, find the `navItems` array:

```typescript
const navItems = [
  { href: '/', icon: '⊞', label: 'Dashboard' },
  { href: '/slip', icon: '📋', label: 'Bet Slip' },
]
```

Replace with:

```typescript
const navItems = [
  { href: '/', icon: '⊞', label: 'Dashboard' },
  { href: '/slip', icon: '📋', label: 'Bet Slip' },
  { href: '/accumulators', icon: '◈', label: 'Accumulators' },
]
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: add Accumulators link to sidebar nav"
```

---

## Task 12: Smoke Test in Browser

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the following manually**

1. Navigate to `http://localhost:3000/accumulators` — page loads with Craft/Saved tabs
2. Craft tab shows the criteria form with Timeframe toggle, input fields, Risk Rating buttons, and Craft button
3. Click Craft — results list appears (or "No selections match" if no reports exist in range)
4. If results appear: click "+ Add" on a result — it appears in the builder panel, Add button becomes "Added"
5. Add 2+ legs — total odds shows, Generate AI Summary button becomes active
6. Click Generate AI Summary — loading state appears, then summary text renders
7. Enter a name and click Save Accumulator — success message appears, legs clear
8. Click Saved tab — saved accumulator appears with name, legs count, total odds
9. Click to expand — legs table and AI summary visible, Delete button present
10. Click Delete — confirm dialog, accumulator removed from list
11. Sidebar shows ◈ Accumulators link on desktop, and in bottom nav on mobile

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: accumulator builder — complete feature"
```
