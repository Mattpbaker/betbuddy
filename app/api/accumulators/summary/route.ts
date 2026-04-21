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
