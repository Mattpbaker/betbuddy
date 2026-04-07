export interface Team {
  id: string
  api_football_id: number
  name: string
  country: string
  competition: string
  logo_url: string | null
}

export interface Player {
  id: string
  api_football_id: number
  team_id: string
  name: string
  position: string | null
  nationality: string | null
}

export interface Match {
  id: string
  api_football_id: number
  home_team_id: string
  away_team_id: string
  competition: string
  match_date: string
  venue: string | null
  status: string
  home_team?: Team
  away_team?: Team
  odds?: Odd[]
  report?: Report
}

export interface MatchResult {
  id: string
  match_id: string
  home_score: number | null
  away_score: number | null
  ht_home_score: number | null
  ht_away_score: number | null
  home_corners: number | null
  away_corners: number | null
  home_yellow_cards: number | null
  away_yellow_cards: number | null
}

export interface PlayerStats {
  id: string
  player_id: string
  match_id: string
  goals: number
  assists: number
  shots_on_target: number
  yellow_cards: number
  red_cards: number
  minutes_played: number
  player?: Player
}

export interface TeamForm {
  team_id?: string        // optional — not present in AI-generated reports
  last_5_results: FormResult[]
  goals_scored_last5: number
  goals_conceded_last5: number
  updated_at?: string     // optional — not present in AI-generated reports
}

export interface FormResult {
  match_id: string
  opponent: string
  home: boolean
  home_score: number
  away_score: number
  date: string
}

export interface Odd {
  id: string
  match_id: string
  market: string
  selection: string
  value: number
  bookmaker: string | null
  fetched_at: string
}

export interface ReportContent {
  form: {
    home: TeamForm
    away: TeamForm
  }
  h2h: {
    matches: FormResult[]
    avg_goals: number
    home_wins: number
    away_wins: number
    draws: number
  }
  squad: {
    home_injuries: string[]
    home_suspensions: string[]
    away_injuries: string[]
    away_suspensions: string[]
  }
  key_players: {
    home: { name: string; stats: string }[]
    away: { name: string; stats: string }[]
  }
  home_away_record: {
    home_team_home: string
    away_team_away: string
  }
  league_context: {
    home_position: number
    away_position: number
    home_points: number
    away_points: number
    notes: string
  }
  tactical_notes: string
  conditions: string
  suggestions: BetSuggestion[]
}

export interface BetSuggestion {
  label: string
  market: string
  selection: string
  odds: number
  reasoning: string
  confidence: 'High' | 'Medium' | 'Low'
}

export interface Report {
  id: string
  match_id: string
  content: ReportContent
  generated_at: string
  triggered_by: string
}

export interface BetSlip {
  id: string
  stake: number
  status: 'draft' | 'archived'
  created_at: string
  items?: BetSlipItem[]
}

export interface BetSlipItem {
  id: string
  slip_id: string
  match_id: string
  market: string
  selection: string
  odds: number
  report_id: string | null
  match?: Match
}
