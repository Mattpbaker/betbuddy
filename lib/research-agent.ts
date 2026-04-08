// lib/research-agent.ts
import Anthropic from '@anthropic-ai/sdk'
import type { ReportContent } from '@/types'

export interface ResearchContext {
  homeForm: any[]
  awayForm: any[]
  h2h: any[]
  homeInjuries: any[]
  awayInjuries: any[]
  standings: any[]
  prediction?: any | null       // API-Football Poisson prediction
  homeLineup?: any | null       // Starting XI if announced
  awayLineup?: any | null
}

export function buildResearchPrompt(
  homeTeam: string,
  awayTeam: string,
  context: ResearchContext
): string {
  const lineupSection = context.homeLineup || context.awayLineup
    ? `
### Announced Lineups:
${homeTeam}: ${context.homeLineup
  ? `Formation: ${context.homeLineup.formation} | XI: ${context.homeLineup.start_xi.map((p: any) => p.name).join(', ')}`
  : 'Not yet announced'}
${awayTeam}: ${context.awayLineup
  ? `Formation: ${context.awayLineup.formation} | XI: ${context.awayLineup.start_xi.map((p: any) => p.name).join(', ')}`
  : 'Not yet announced'}`
    : ''

  const predictionSection = context.prediction
    ? `
### Statistical Prediction (Poisson model):
Advice: ${context.prediction.advice}
Win probability — ${homeTeam}: ${context.prediction.home_win_percent}, Draw: ${context.prediction.draw_percent}, ${awayTeam}: ${context.prediction.away_win_percent}
Predicted winner: ${context.prediction.winner_name ?? 'Draw'}
Over/Under signal: ${context.prediction.under_over ?? 'N/A'}
${homeTeam} last-5 form: ${context.prediction.home_form ?? 'N/A'}
${awayTeam} last-5 form: ${context.prediction.away_form ?? 'N/A'}
Comparison: ${JSON.stringify(context.prediction.comparison)}`
    : ''

  return `You are a football betting research analyst. Analyse the upcoming match between ${homeTeam} (home) and ${awayTeam} (away) using the data provided below.

## Available Data

### ${homeTeam} Recent Form (last 5):
${JSON.stringify(context.homeForm, null, 2)}

### ${awayTeam} Recent Form (last 5):
${JSON.stringify(context.awayForm, null, 2)}

### Head-to-head (last 5 meetings):
${JSON.stringify(context.h2h, null, 2)}

### ${homeTeam} Injuries/Suspensions:
${JSON.stringify(context.homeInjuries, null, 2)}

### ${awayTeam} Injuries/Suspensions:
${JSON.stringify(context.awayInjuries, null, 2)}

### League Standings:
${JSON.stringify(context.standings, null, 2)}
${lineupSection}
${predictionSection}

## Instructions

Produce a structured JSON report covering ALL of the following 9 sections:

1. **recent form** — last 5 results per team, goals scored/conceded, clean sheets
2. **head-to-head** — last 5 meetings, average goals, home/away patterns
3. **squad availability** — confirmed injuries, suspensions, doubtful players, key players missing from lineup if announced
4. **key players** — top performers last 3-5 games (goals, assists, cards, shots)
5. **home/away record** — season performance split by venue
6. **league context** — table position, points gap, motivation
7. **tactical** — formation (use announced lineup if available), pressing style, set piece threat
8. **conditions** — weather or pitch notes if known
9. **suggestions** — 2-4 specific betting markets with odds, reasoning, and confidence. Use the statistical prediction as one data point but apply your own analysis.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "form": {
    "home": { "last_5_results": [], "goals_scored_last5": 0, "goals_conceded_last5": 0 },
    "away": { "last_5_results": [], "goals_scored_last5": 0, "goals_conceded_last5": 0 }
  },
  "h2h": { "matches": [], "avg_goals": 0, "home_wins": 0, "away_wins": 0, "draws": 0 },
  "squad": { "home_injuries": [], "home_suspensions": [], "away_injuries": [], "away_suspensions": [] },
  "key_players": { "home": [], "away": [] },
  "home_away_record": { "home_team_home": "", "away_team_away": "" },
  "league_context": { "home_position": 0, "away_position": 0, "home_points": 0, "away_points": 0, "notes": "" },
  "tactical_notes": "",
  "conditions": "",
  "suggestions": [
    { "label": "", "market": "", "selection": "", "odds": 0, "reasoning": "", "confidence": "High|Medium|Low" }
  ]
}`
}

export function parseReportContent(rawResponse: string): ReportContent {
  const trimmed = rawResponse.trim()
  // Strip markdown code fences if Claude wraps response despite instructions
  const fenced = /^```(?:json)?\n([\s\S]*?)\n?```\s*$/
  const match = trimmed.match(fenced)
  const cleaned = match ? match[1] : trimmed
  const parsed = JSON.parse(cleaned)

  // Validate top-level keys are present
  const required = ['form', 'h2h', 'squad', 'key_players', 'home_away_record', 'league_context', 'tactical_notes', 'conditions', 'suggestions']
  for (const key of required) {
    if (!(key in parsed)) throw new Error(`parseReportContent: missing required key "${key}"`)
  }

  return parsed as ReportContent
}

let _anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var not set')
    _anthropicClient = new Anthropic({ apiKey })
  }
  return _anthropicClient
}

export async function generateReport(
  homeTeam: string,
  awayTeam: string,
  context: ResearchContext
): Promise<ReportContent> {
  const client = getAnthropicClient()
  const prompt = buildResearchPrompt(homeTeam, awayTeam, context)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('')

  return parseReportContent(text)
}
