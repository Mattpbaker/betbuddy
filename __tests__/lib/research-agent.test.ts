// __tests__/lib/research-agent.test.ts
import { buildResearchPrompt, parseReportContent } from '@/lib/research-agent'

describe('buildResearchPrompt', () => {
  it('includes both team names in the prompt', () => {
    const prompt = buildResearchPrompt('Arsenal', 'Chelsea', {
      homeForm: [],
      awayForm: [],
      h2h: [],
      homeInjuries: [],
      awayInjuries: [],
      standings: [],
    })
    expect(prompt).toContain('Arsenal')
    expect(prompt).toContain('Chelsea')
  })

  it('includes all 9 research sections in the instructions', () => {
    const prompt = buildResearchPrompt('Arsenal', 'Chelsea', {
      homeForm: [],
      awayForm: [],
      h2h: [],
      homeInjuries: [],
      awayInjuries: [],
      standings: [],
    })
    expect(prompt).toContain('recent form')
    expect(prompt).toContain('head-to-head')
    expect(prompt).toContain('squad availability')
    expect(prompt).toContain('key player')
    expect(prompt).toContain('home/away record')
    expect(prompt).toContain('league context')
    expect(prompt).toContain('tactical')
    expect(prompt).toContain('conditions')
    expect(prompt).toContain('suggestions')
  })
})

describe('parseReportContent', () => {
  it('parses valid JSON report from Claude response', () => {
    const mockResponse = JSON.stringify({
      form: { home: { last_5_results: [], goals_scored_last5: 8, goals_conceded_last5: 2 }, away: { last_5_results: [], goals_scored_last5: 5, goals_conceded_last5: 5 } },
      h2h: { matches: [], avg_goals: 2.6, home_wins: 3, away_wins: 1, draws: 1 },
      squad: { home_injuries: ['Reece James'], home_suspensions: [], away_injuries: [], away_suspensions: [] },
      key_players: { home: [{ name: 'Saka', stats: '4G 3A last 5' }], away: [{ name: 'Palmer', stats: '2G 2A last 5' }] },
      home_away_record: { home_team_home: '4W 0D 1L', away_team_away: '2W 1D 2L' },
      league_context: { home_position: 2, away_position: 4, home_points: 65, away_points: 58, notes: 'Title race tightening.' },
      tactical_notes: 'Arsenal press high. Chelsea counter.',
      conditions: 'Clear, 12°C.',
      suggestions: [{ label: 'Arsenal Win', market: 'h2h', selection: 'Arsenal', odds: 1.85, reasoning: 'Strong home record.', confidence: 'High' }],
    })

    const result = parseReportContent(mockResponse)
    expect(result.suggestions).toHaveLength(1)
    expect(result.suggestions[0].confidence).toBe('High')
    expect(result.squad.home_injuries).toContain('Reece James')
  })

  it('strips markdown code fences before parsing', () => {
    const withFences = '```json\n{"form":{"home":{"last_5_results":[],"goals_scored_last5":0,"goals_conceded_last5":0},"away":{"last_5_results":[],"goals_scored_last5":0,"goals_conceded_last5":0}},"h2h":{"matches":[],"avg_goals":0,"home_wins":0,"away_wins":0,"draws":0},"squad":{"home_injuries":[],"home_suspensions":[],"away_injuries":[],"away_suspensions":[]},"key_players":{"home":[],"away":[]},"home_away_record":{"home_team_home":"","away_team_away":""},"league_context":{"home_position":0,"away_position":0,"home_points":0,"away_points":0,"notes":""},"tactical_notes":"","conditions":"","suggestions":[]}\n```'
    const result = parseReportContent(withFences)
    expect(result.suggestions).toEqual([])
  })

  it('throws on invalid JSON', () => {
    expect(() => parseReportContent('not json')).toThrow()
  })
})
