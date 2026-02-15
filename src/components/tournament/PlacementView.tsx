import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TeamAvatar } from "@/components/matches/TeamAvatar";
import type { TournamentMatch, Team } from "@/types/database";
import { formatInBelgrade } from "@/lib/utils/datetime";

interface Props {
  matches: TournamentMatch[];
  teamsMap: Map<string, Team>;
  labels: {
    completed: string;
    playoffStage: string;
    shootoutShort: string;
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
        const teamA = match.team_a_id ? teamsMap.get(match.team_a_id) : undefined;
        const teamB = match.team_b_id ? teamsMap.get(match.team_b_id) : undefined;
        const winner =
          match.team_a_id &&
          match.team_b_id &&
          match.is_completed
            ? match.shootout_winner === "team_a"
              ? match.team_a_id
              : match.shootout_winner === "team_b"
                ? match.team_b_id
                : match.score_a !== match.score_b
                  ? match.score_a > match.score_b
                    ? match.team_a_id
                    : match.team_b_id
                  : null
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
                  <div className="inline-flex items-center gap-2">
                    <span className="text-sm">{teamA?.name ?? "TBD"}</span>
                    <TeamAvatar
                      name={teamA?.name ?? "TBD"}
                      logoUrl={teamA?.logo_url}
                      country={teamA?.country}
                      size="xs"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="relative">
                      <span className="text-lg font-bold tabular-nums">
                        {match.score_a}
                      </span>
                      {match.shootout_winner === "team_a" && (
                        <span className="absolute -top-2 -right-2.5 text-[8px] font-bold text-amber-400 bg-amber-500/15 px-0.5 rounded leading-tight">{labels.shootoutShort}</span>
                      )}
                    </span>
                    <span className="text-muted-foreground">:</span>
                    <span className="relative">
                      <span className="text-lg font-bold tabular-nums">
                        {match.score_b}
                      </span>
                      {match.shootout_winner === "team_b" && (
                        <span className="absolute -top-2 -right-2.5 text-[8px] font-bold text-amber-400 bg-amber-500/15 px-0.5 rounded leading-tight">{labels.shootoutShort}</span>
                      )}
                    </span>
                  </div>
                </div>
                <div
                  className={`text-left flex-1 ${
                    winner === match.team_b_id
                      ? "font-bold text-green-400"
                      : ""
                  } ${teamB?.is_propeleri ? "text-primary" : ""}`}
                >
                  <div className="inline-flex items-center gap-2">
                    <TeamAvatar
                      name={teamB?.name ?? "TBD"}
                      logoUrl={teamB?.logo_url}
                      country={teamB?.country}
                      size="xs"
                    />
                    <span className="text-sm">{teamB?.name ?? "TBD"}</span>
                  </div>
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
                  {formatInBelgrade(match.match_date, "sr-Latn", {
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
