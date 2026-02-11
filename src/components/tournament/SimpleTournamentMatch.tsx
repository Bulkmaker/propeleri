import { Card, CardContent } from "@/components/ui/card";
import { TeamAvatar } from "@/components/matches/TeamAvatar";
import type { Team, TournamentMatch } from "@/types/database";

interface SimpleTournamentMatchProps {
  match: TournamentMatch;
  teamA: Team | null;
  teamB: Team | null;
  dateLabel: string;
  timeLabel: string;
}

export function SimpleTournamentMatch({
  match,
  teamA,
  teamB,
  dateLabel,
  timeLabel,
}: SimpleTournamentMatchProps) {
  const isCompleted = match.is_completed;
  const teamAName = teamA?.name || "TBD";
  const teamBName = teamB?.name || "TBD";

  return (
    <Card className="border-border/40 bg-card/95">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Team A */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {teamA && (
              <TeamAvatar
                name={teamA.name}
                logoUrl={teamA.logo_url}
                country={teamA.country}
                size="md"
              />
            )}
            <span className="font-semibold text-sm md:text-base truncate">
              {teamAName}
            </span>
          </div>

          {/* Score or Time */}
          <div className="text-center shrink-0 px-4">
            {isCompleted ? (
              <div className="text-2xl font-bold tabular-nums">
                {match.score_a ?? 0}:{match.score_b ?? 0}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {dateLabel}
                </div>
                <div className="text-sm font-semibold whitespace-nowrap">
                  {timeLabel}
                </div>
              </div>
            )}
          </div>

          {/* Team B */}
          <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
            <span className="font-semibold text-sm md:text-base truncate">
              {teamBName}
            </span>
            {teamB && (
              <TeamAvatar
                name={teamB.name}
                logoUrl={teamB.logo_url}
                country={teamB.country}
                size="md"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
