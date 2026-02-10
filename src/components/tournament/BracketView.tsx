import { Badge } from "@/components/ui/badge";
import type { TournamentMatch, Team } from "@/types/database";

interface Props {
  matches: TournamentMatch[];
  teamsMap: Map<string, Team>;
  labels: {
    completed: string;
    bracket: string;
    thirdPlace: string;
  };
}

export function BracketView({ matches, teamsMap, labels }: Props) {
  if (matches.length === 0) return null;

  // Group by bracket_round, sort by bracket_position
  const rounds = new Map<number, TournamentMatch[]>();
  const unrounded: TournamentMatch[] = [];

  for (const m of matches) {
    if (m.bracket_round != null) {
      const arr = rounds.get(m.bracket_round) ?? [];
      arr.push(m);
      rounds.set(m.bracket_round, arr);
    } else {
      unrounded.push(m);
    }
  }

  // Sort within each round
  for (const arr of rounds.values()) {
    arr.sort((a, b) => (a.bracket_position ?? 0) - (b.bracket_position ?? 0));
  }

  const sortedRounds = Array.from(rounds.entries()).sort(
    ([a], [b]) => a - b
  );

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm text-muted-foreground">
        {labels.bracket}
      </h3>

      {/* Bracket grid if rounds exist */}
      {sortedRounds.length > 0 && (
        <div className="flex gap-6 overflow-x-auto pb-2">
          {sortedRounds.map(([round, roundMatches]) => (
            <div key={round} className="flex flex-col gap-4 min-w-[200px]">
              <p className="text-xs font-medium text-muted-foreground text-center">
                {roundMatches[0]?.bracket_label ??
                  `Round ${round}`}
              </p>
              {roundMatches.map((match) => (
                <BracketMatchCard
                  key={match.id}
                  match={match}
                  teamsMap={teamsMap}
                  labels={labels}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Matches without rounds — shown as simple list */}
      {unrounded.length > 0 && (
        <div className="space-y-3">
          {unrounded.map((match) => (
            <BracketMatchCard
              key={match.id}
              match={match}
              teamsMap={teamsMap}
              labels={labels}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BracketMatchCard({
  match,
  teamsMap,
  labels,
}: {
  match: TournamentMatch;
  teamsMap: Map<string, Team>;
  labels: { completed: string };
}) {
  const teamA = teamsMap.get(match.team_a_id);
  const teamB = teamsMap.get(match.team_b_id);
  const winner =
    match.is_completed && match.score_a !== match.score_b
      ? match.score_a > match.score_b
        ? match.team_a_id
        : match.team_b_id
      : null;

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden bg-card/30">
      {match.bracket_label && !match.bracket_round && (
        <div className="px-3 py-1 bg-purple-500/10 border-b border-border/20">
          <p className="text-xs font-medium text-purple-400">
            {match.bracket_label}
          </p>
        </div>
      )}
      <div className="divide-y divide-border/20">
        <div
          className={`flex items-center justify-between px-3 py-2 ${
            winner === match.team_a_id ? "bg-green-500/5" : ""
          }`}
        >
          <span
            className={`text-sm truncate ${
              winner === match.team_a_id ? "font-bold text-green-400" : ""
            } ${teamA?.is_propeleri ? "text-primary" : ""}`}
          >
            {teamA?.name ?? "?"}
          </span>
          <span className="text-sm font-bold tabular-nums ml-2">
            {match.score_a}
          </span>
        </div>
        <div
          className={`flex items-center justify-between px-3 py-2 ${
            winner === match.team_b_id ? "bg-green-500/5" : ""
          }`}
        >
          <span
            className={`text-sm truncate ${
              winner === match.team_b_id ? "font-bold text-green-400" : ""
            } ${teamB?.is_propeleri ? "text-primary" : ""}`}
          >
            {teamB?.name ?? "?"}
          </span>
          <span className="text-sm font-bold tabular-nums ml-2">
            {match.score_b}
          </span>
        </div>
      </div>
      {match.is_completed && (
        <div className="flex justify-center py-1 bg-card/20">
          <Badge className="bg-green-600/20 text-green-400 text-[10px]">
            {labels.completed}
          </Badge>
        </div>
      )}
    </div>
  );
}
