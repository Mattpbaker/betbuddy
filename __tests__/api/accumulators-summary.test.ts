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
