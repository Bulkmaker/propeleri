import type { PlayerPosition, PlayerRole, GameResult } from "@/types/database";

export const POSITIONS: PlayerPosition[] = ["forward", "defense", "goalie"];

export const ROLES: PlayerRole[] = [
  "player",
  "captain",
  "assistant_captain",
];

export const GAME_RESULTS: GameResult[] = ["win", "loss", "draw", "pending"];

export const POSITION_COLORS: Record<PlayerPosition, string> = {
  forward: "bg-team-orange text-white",
  defense: "bg-blue-600 text-white",
  goalie: "bg-team-silver text-white",
};

export const RESULT_COLORS: Record<GameResult, string> = {
  win: "bg-green-600 text-white",
  loss: "bg-red-600 text-white",
  draw: "bg-yellow-600 text-black",
  pending: "bg-muted text-muted-foreground",
};
