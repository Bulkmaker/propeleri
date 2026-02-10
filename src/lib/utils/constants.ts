import type { PlayerPosition, PlayerRole, GameResult, TrainingTeam, SlotPosition } from "@/types/database";

export const POSITIONS: PlayerPosition[] = ["forward", "defense", "goalie"];

export const ROLES: PlayerRole[] = [
  "player",
  "captain",
  "assistant_captain",
];

export const GAME_RESULTS: GameResult[] = ["win", "loss", "draw", "pending"];

export const TRAINING_TEAMS: TrainingTeam[] = ["team_a", "team_b"];

export const POSITION_COLORS: Record<PlayerPosition, string> = {
  forward: "bg-team-orange text-white",
  defense: "bg-blue-600 text-white",
  goalie: "bg-team-silver text-white",
};

export const POSITION_COLORS_HEX: Record<PlayerPosition, string> = {
  forward: "#e8732a",
  defense: "#2563eb",
  goalie: "#9ca3af",
};

export const SLOT_TO_POSITION: Record<SlotPosition, PlayerPosition> = {
  LW: "forward",
  C: "forward",
  RW: "forward",
  LD: "defense",
  RD: "defense",
  GK: "goalie",
};

export const LINE_SLOTS: SlotPosition[] = ["LW", "C", "RW", "LD", "RD"];
export const GOALIE_SLOTS: SlotPosition[] = ["GK"];

export const RESULT_COLORS: Record<GameResult, string> = {
  win: "bg-green-600 text-white",
  loss: "bg-red-600 text-white",
  draw: "bg-yellow-600 text-black",
  pending: "bg-muted text-muted-foreground",
};
