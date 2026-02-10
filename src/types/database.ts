export type PlayerPosition = "forward" | "defense" | "goalie";
export type PlayerRole = "player" | "captain" | "assistant_captain";
export type AppRole = "admin" | "player";
export type EventType = "game" | "training" | "tournament" | "social";
export type LineupDesignation = "captain" | "assistant_captain" | "player";
export type GameResult = "win" | "loss" | "draw" | "pending";
export type TrainingTeam = "team_a" | "team_b";

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
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
  default_training_team: TrainingTeam | null;
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
  opponent: string;
  location: string | null;
  game_date: string;
  home_score: number;
  away_score: number;
  is_home: boolean;
  result: GameResult;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameLineup {
  id: string;
  game_id: string;
  player_id: string;
  designation: LineupDesignation;
  position_played: PlayerPosition;
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
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingStats {
  id: string;
  session_id: string;
  player_id: string;
  attended: boolean;
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
  location: string | null;
  start_date: string;
  end_date: string;
  description: string | null;
  created_at: string;
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
