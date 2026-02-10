import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TournamentMatch, Team } from "@/types/database";

interface Props {
  matches: TournamentMatch[];
  teamsMap: Map<string, Team>;
  labels: {
    completed: string;
    playoffStage: string;
  };
}

export function PlacementView({ matches, teamsMap, labels }: Props) {
  if (matches.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground">
        {labels.playoffStage}
      </h3>
      {matches.map((match) => {
        const teamA = teamsMap.get(match.team_a_id);
        const teamB = teamsMap.get(match.team_b_id);
        const winner =
          match.is_completed && match.score_a !== match.score_b
            ? match.score_a > match.score_b
              ? match.team_a_id
              : match.team_b_id
            : null;

        return (
          <Card key={match.id} className="border-border/40">
            <CardContent className="p-4">
              {match.bracket_label && (
                <p className="text-xs font-medium text-purple-400 mb-2">
                  {match.bracket_label}
                </p>
              )}
              <div className="flex items-center justify-center gap-4">
                <div
                  className={`text-right flex-1 ${
                    winner === match.team_a_id
                      ? "font-bold text-green-400"
                      : ""
                  } ${teamA?.is_propeleri ? "text-primary" : ""}`}
                >
                  <span className="text-sm">{teamA?.name ?? "?"}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-lg font-bold tabular-nums">
                    {match.score_a}
                  </span>
                  <span className="text-muted-foreground">:</span>
                  <span className="text-lg font-bold tabular-nums">
                    {match.score_b}
                  </span>
                </div>
                <div
                  className={`text-left flex-1 ${
                    winner === match.team_b_id
                      ? "font-bold text-green-400"
                      : ""
                  } ${teamB?.is_propeleri ? "text-primary" : ""}`}
                >
                  <span className="text-sm">{teamB?.name ?? "?"}</span>
                </div>
              </div>
              {match.is_completed && (
                <div className="flex justify-center mt-2">
                  <Badge className="bg-green-600/20 text-green-400 text-xs">
                    {labels.completed}
                  </Badge>
                </div>
              )}
              {match.match_date && (
                <p className="text-xs text-muted-foreground text-center mt-1">
                  {new Date(match.match_date).toLocaleString("sr-Latn", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
