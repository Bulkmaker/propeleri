export type PlayerPosition = "forward" | "defense" | "goalie";
export type PlayerRole = "player" | "captain" | "assistant_captain";
export type AppRole = "admin" | "player";
export type EventType = "game" | "training" | "tournament" | "social";
export type LineupDesignation = "captain" | "assistant_captain" | "player";
export type GameResult = "win" | "loss" | "draw" | "pending";
export type TournamentFormat = "cup" | "placement" | "round_robin" | "custom";
export type TournamentMatchStage = "group" | "playoff";
export type TrainingTeam = "team_a" | "team_b";
export type TrainingSessionStatus = "planned" | "completed" | "canceled";
export type SlotPosition = "LW" | "C" | "RW" | "LD" | "RD" | "GK";

export interface TrainingGoalEvent {
  team: TrainingTeam;
  scorer_player_id: string;
  assist_player_id: string | null;
}

export interface TrainingMatchData {
  version: 1;
  team_a_score: number;
  team_b_score: number;
  team_a_goalie_player_id: string | null;
  team_b_goalie_player_id: string | null;
  goal_events: TrainingGoalEvent[];
}

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  first_name: string;
  last_name: string;
  nickname: string | null;
  jersey_number: number | null;
  position: PlayerPosition;
  team_role: PlayerRole;
  app_role: AppRole;
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  phone: string | null;
  height: number | null;
  weight: number | null;
  nationality: string | null;
  second_nationality: string | null;
  default_training_team: TrainingTeam | null;
  is_guest: boolean;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Game {
  id: string;
  season_id: string;
  tournament_id: string | null;
  opponent_team_id: string | null;
  opponent: string | null;
  location: string | null;
  game_date: string;
  home_score: number;
  away_score: number;
  is_home: boolean;
  result: GameResult;
  auto_generated_from_tournament: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Joins
  opponent_team?: Team;
}

export interface GameLineup {
  id: string;
  game_id: string;
  player_id: string;
  designation: LineupDesignation;
  position_played: PlayerPosition;
  line_number: number;
  slot_position: SlotPosition | null;
  created_at: string;
  player?: Profile;
}

export interface GameStats {
  id: string;
  game_id: string;
  player_id: string;
  goals: number;
  assists: number;
  penalty_minutes: number;
  plus_minus: number;
  created_at: string;
  player?: Profile;
}

export interface TrainingSession {
  id: string;
  season_id: string;
  title: string | null;
  session_date: string;
  status: TrainingSessionStatus;
  location: string | null;
  notes: string | null;
  match_data: TrainingMatchData | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingStats {
  id: string;
  session_id: string;
  player_id: string;
  attended: boolean;
  is_guest: boolean;
  goals: number;
  assists: number;
  training_team: TrainingTeam | null;
  notes: string | null;
  created_at: string;
  player?: Profile;
}

export interface Tournament {
  id: string;
  season_id: string;
  name: string;
  format: TournamentFormat;
  location: string | null;
  start_date: string;
  end_date: string;
  description: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  is_propeleri: boolean;
  created_at: string;
}

// Opponent interface removed (merged into Team)

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  team_id: string;
  sort_order: number;
  created_at: string;
  team?: Team;
}

export interface TournamentGroup {
  id: string;
  tournament_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface TournamentGroupTeam {
  id: string;
  group_id: string;
  team_id: string;
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  group_id: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number;
  score_b: number;
  match_date: string | null;
  is_completed: boolean;
  stage: TournamentMatchStage;
  bracket_round: number | null;
  bracket_position: number | null;
  bracket_label: string | null;
  game_id: string | null;
  created_at: string;
  updated_at: string;
  team_a?: Team;
  team_b?: Team;
}

export interface TournamentPlayerRegistration {
  id: string;
  tournament_id: string;
  player_id: string;
  created_at: string;
}

export interface GroupStandingRow {
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

export interface TeamEvent {
  id: string;
  title: string;
  title_ru: string | null;
  title_en: string | null;
  description: string | null;
  description_ru: string | null;
  description_en: string | null;
  event_type: EventType;
  event_date: string | null;
  location: string | null;
  cover_image_url: string | null;
  tournament_id: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GalleryAlbum {
  id: string;
  title: string;
  title_ru: string | null;
  title_en: string | null;
  description: string | null;
  cover_image_url: string | null;
  event_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface GalleryPhoto {
  id: string;
  album_id: string;
  image_url: string;
  caption: string | null;
  uploaded_by: string | null;
  sort_order: number;
  created_at: string;
}

// Computed views
export interface PlayerGameTotals {
  player_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  position: PlayerPosition;
  games_played: number;
  total_goals: number;
  total_assists: number;
  total_points: number;
  total_pim: number;
  total_plus_minus: number;
}

export interface PlayerTrainingTotals {
  player_id: string;
  first_name: string;
  last_name: string;
  sessions_attended: number;
  training_goals: number;
  training_assists: number;
}

export interface PlayerSeasonStats {
  player_id: string;
  season_id: string;
  season_name: string;
  games_played: number;
  goals: number;
  assists: number;
  points: number;
  pim: number;
  plus_minus: number;
}

export type GoalPeriod = "1" | "2" | "3" | "OT" | "SO";
export type GoaliePerformance = "excellent" | "good" | "average" | "bad";

export interface GoalEventInput {
  scorer_player_id: string;
  assist_1_player_id: string;
  assist_2_player_id: string;
  period: GoalPeriod;
  goal_time: string;
}

export interface GoalieReportInput {
  goalie_player_id: string;
  performance: GoaliePerformance;
}

export interface GameNotesPayload {
  version: 1;
  goal_events: GoalEventInput[];
  goalie_report: GoalieReportInput | null;
}
