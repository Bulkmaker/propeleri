import type { TrainingGoalEvent, TrainingMatchData } from "@/types/database";

type ParsedTrainingGoalEvent = {
  team: "team_a" | "team_b";
  scorer_player_id: string;
  assist_player_id: string | null;
};

export function parseTrainingMatchData(raw: unknown): TrainingMatchData | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<TrainingMatchData>;

  const events: ParsedTrainingGoalEvent[] = Array.isArray(value.goal_events)
    ? value.goal_events
        .map((event) => {
          if (!event || typeof event !== "object") return null;
          const eventValue = event as Partial<TrainingGoalEvent>;
          if (eventValue.team !== "team_a" && eventValue.team !== "team_b") return null;
          if (typeof eventValue.scorer_player_id !== "string") return null;

          return {
            team: eventValue.team,
            scorer_player_id: eventValue.scorer_player_id,
            assist_player_id:
              typeof eventValue.assist_player_id === "string"
                ? eventValue.assist_player_id
                : null,
          };
        })
        .filter((event): event is ParsedTrainingGoalEvent => Boolean(event))
    : [];

  return {
    version: 1,
    team_a_score:
      typeof value.team_a_score === "number" && value.team_a_score >= 0
        ? value.team_a_score
        : 0,
    team_b_score:
      typeof value.team_b_score === "number" && value.team_b_score >= 0
        ? value.team_b_score
        : 0,
    team_a_goalie_player_id:
      typeof value.team_a_goalie_player_id === "string"
        ? value.team_a_goalie_player_id
        : null,
    team_b_goalie_player_id:
      typeof value.team_b_goalie_player_id === "string"
        ? value.team_b_goalie_player_id
        : null,
    goal_events: events,
  };
}
