# Accumulator Builder — Design Spec

**Date:** 2026-04-20  
**Status:** Approved

---

## Overview

A new `/accumulators` page that lets the user define bet criteria, scan upcoming matches for qualifying AI report suggestions, manually assemble an accumulator from the results, optionally generate an AI narrative for the combined bet, and save it as a named draft.

---

## Page Structure

Route: `/accumulators`

Two tabs:
- **Craft** — criteria form, results list, and draft builder panel
- **Saved** — list of all saved accumulators

---

## Craft Tab

### Phase 1: Criteria Form

All fields are optional except Timeframe.

| Field | Type | Notes |
|---|---|---|
| Timeframe | Toggle: 1 day / 3 days | Required, defaults to 1 day |
| Number of selections | Number input | Advisory — shows target leg count in builder panel; does not filter the results list |
| Min total multiplier | Number input | Shown as running feedback in builder; no hard filter on results list |
| Min odds per leg | Number input | Filters suggestions below this threshold |
| Max odds per leg | Number input | Filters suggestions above this threshold |
| Risk rating | Multi-select: High / Medium / Low | Maps to `confidence` field on AI report suggestions; if none selected, all are shown |

**Craft button** — triggers the search. Always enabled (Timeframe always has a value).

> **Note on "number of selections":** This does not pre-filter the results list to exactly N items. It is advisory — it signals intent so the user can see how many they're aiming for in the builder panel. The results list always shows all qualifying selections.

### Phase 2: Results + Builder (split layout)

Displayed after Craft is clicked.

**Left — Results List:**
- Each row: match name, match date/time, competition, market, selection, odds, confidence badge (colour-coded: green=High, amber=Medium, red=Low)
- "Add" button per row — disabled if already added to builder
- Sorted by match date ascending

**Right — Draft Builder Panel:**
- Lists added legs with: match name, selection, odds, confidence badge, remove button
- Running total multiplier (product of all leg odds), updates live
- Name input field
- "Generate AI Summary" button (disabled until at least 2 legs added)
- "Save" button (disabled until named and at least 2 legs added)

---

## AI Summary

Triggered by "Generate AI Summary" button in the builder panel.

- POSTs selected legs to `/api/accumulators/summary`
- Server sends a prompt to Claude (claude-sonnet-4-6) asking for a brief assessment of the combined bet: individual leg rationale, how the legs complement each other, overall risk verdict
- Response is a short narrative (target ~150–200 words)
- Summary renders beneath the legs list in the builder panel
- Generating a new summary overwrites the previous one
- Summary is saved alongside the accumulator when the user saves

---

## Saved Tab

List of all saved accumulators, ordered by created_at descending. Each entry shows:

- Name
- Date saved
- Number of legs + total multiplier (e.g. "4 legs · 12.4x")
- Confidence breakdown (e.g. "2 High, 1 Medium, 1 Low")
- First sentence of AI summary (if present), truncated
- Expand/collapse to reveal full legs table + full AI summary
- Delete button (with confirmation)

No edit functionality — saved accumulators are read-only. To revise, delete and craft a new one.

---

## Data Flow

### Craft Search

1. User fills criteria and clicks Craft
2. Client calls `GET /api/accumulators/candidates?timeframe=1` (or `3`)
3. Server queries Supabase: all matches in the timeframe window that have a report with at least one suggestion
4. Returns matches with their full suggestion arrays, odds, and team names
5. Client filters suggestions against criteria (odds range, confidence) entirely in the browser
6. Results list renders — no further server calls when adjusting is not needed post-craft

### Save

1. User clicks Save
2. Client POSTs to `POST /api/accumulators` with: name, ai_summary, legs array
3. Server inserts into `accumulators` and `accumulator_legs` tables
4. Saved tab updates on next visit

### Delete

- `DELETE /api/accumulators/[id]` — deletes accumulator and its legs (cascade)

---

## Database

### New table: `accumulators`

```sql
CREATE TABLE accumulators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  total_odds numeric(8,2) NOT NULL,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### New table: `accumulator_legs`

```sql
CREATE TABLE accumulator_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accumulator_id uuid NOT NULL REFERENCES accumulators(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id),
  market text NOT NULL,
  selection text NOT NULL,
  odds numeric(6,2) NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('High', 'Medium', 'Low')),
  report_id uuid REFERENCES reports(id)
);
```

---

## New API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/accumulators/candidates` | Fetch matches + report suggestions for timeframe |
| POST | `/api/accumulators/summary` | Generate AI narrative for a set of legs |
| GET | `/api/accumulators` | List all saved accumulators with legs |
| POST | `/api/accumulators` | Save a new accumulator |
| DELETE | `/api/accumulators/[id]` | Delete an accumulator |

---

## New Pages / Components

- `app/accumulators/page.tsx` — server component shell, renders tab layout
- `components/AccumulatorCraftTab.tsx` — client component: criteria form, results list, builder panel
- `components/AccumulatorSavedTab.tsx` — client component: saved list with expand/collapse
- `components/AccumulatorBuilderPanel.tsx` — the right-side draft builder panel
- `components/AccumulatorResultRow.tsx` — single row in the results list
- `components/AccumulatorSavedCard.tsx` — single saved accumulator card

---

## Out of Scope

- Editing a saved accumulator (delete and re-craft instead)
- Integration with the existing `/slip` bet slip
- Staking / odds tracking / settlement
- Push notifications for saved accumulator matches going live
