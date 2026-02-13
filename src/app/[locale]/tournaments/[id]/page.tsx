import { createClient } from "@/lib/supabase/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import { TeamAvatar } from "@/components/matches/TeamAvatar";
import { Award, MapPin, Calendar } from "lucide-react";
import { GroupStandingsTable } from "@/components/tournament/GroupStandingsTable";
import { PlacementView } from "@/components/tournament/PlacementView";
import { BracketView } from "@/components/tournament/BracketView";
import { computeGroupStandings } from "@/lib/utils/tournament";
import { formatInBelgrade } from "@/lib/utils/datetime";
import type {
  Team,
  TournamentTeam,
  TournamentGroup,
  TournamentGroupTeam,
  TournamentMatch,
  TournamentFormat,
} from "@/types/database";

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  cup: "formatCup",
  placement: "formatPlacement",
  round_robin: "formatRoundRobin",
  custom: "formatCustom",
};

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const tt = await getTranslations("tournament");

  const [tournamentRes, junctionsRes, allTeamsRes, groupsRes, gtRes, matchesRes] =
    await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).single(),
      supabase
        .from("tournament_teams")
        .select("*")
        .eq("tournament_id", id)
        .order("sort_order"),
      supabase.from("teams").select("*").order("name"),
      supabase
        .from("tournament_groups")
        .select("*")
        .eq("tournament_id", id)
        .order("sort_order"),
      supabase.from("tournament_group_teams").select("*"),
      supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", id)
        .order("match_date", { ascending: true }),
    ]);

  const tournament = tournamentRes.data;
  if (!tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-muted-foreground">
        Tournament not found
      </div>
    );
  }

  const junctions: TournamentTeam[] = junctionsRes.data ?? [];
  const allTeamsList: Team[] = allTeamsRes.data ?? [];
  const teamIdsInTournament = new Set(junctions.map((j) => j.team_id));
  const teams: Team[] = allTeamsList.filter((t) => teamIdsInTournament.has(t.id));

  const groups: TournamentGroup[] = groupsRes.data ?? [];
  const allGroupTeams: TournamentGroupTeam[] = gtRes.data ?? [];
  const matches: TournamentMatch[] = matchesRes.data ?? [];

  // Filter group_teams to this tournament's groups
  const groupIds = new Set(groups.map((g) => g.id));
  const groupTeams = allGroupTeams.filter((gt) => groupIds.has(gt.group_id));

  // Build teams map
  const teamsMap = new Map(teams.map((t) => [t.id, t]));

  // Split matches
  const groupMatches = matches.filter((m) => m.stage === "group");
  const playoffMatches = matches.filter((m) => m.stage === "playoff");

  const format = tournament.format as TournamentFormat;

  const standingsLabels = {
    played: tt("played"),
    won: tt("won"),
    drawn: tt("drawn"),
    lost: tt("lost"),
    goalsFor: tt("goalsFor"),
    goalsAgainst: tt("goalsAgainst"),
    goalDiff: tt("goalDiff"),
    pts: tt("pts"),
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Award className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
            {tt(FORMAT_LABELS[format] ?? "formatCustom")}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {tournament.start_date} — {tournament.end_date}
          </span>
          {tournament.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {tournament.location}
            </span>
          )}
        </div>
        {tournament.description && (
          <p className="text-sm text-muted-foreground mt-2">
            {tournament.description}
          </p>
        )}
      </div>

      {/* Group standings */}
      {groups.length > 0 && (
        <div className="space-y-4 mb-8">
          {groups.map((group) => {
            const memberIds = groupTeams
              .filter((gt) => gt.group_id === group.id)
              .map((gt) => gt.team_id);
            const groupTeamsList = teams.filter((t) =>
              memberIds.includes(t.id)
            );
            const groupMatchList = groupMatches.filter(
              (m) => m.group_id === group.id
            );
            const standings = computeGroupStandings(
              groupTeamsList,
              groupMatchList
            );

            return (
              <GroupStandingsTable
                key={group.id}
                groupName={group.name}
                standings={standings}
                labels={standingsLabels}
              />
            );
          })}
        </div>
      )}

      {/* Playoff / placement (HIDDEN AS REQUESTED) */}
      {/* {playoffMatches.length > 0 && (
        <div className="mb-8">
          {format === "cup" ? (
            <BracketView
              matches={playoffMatches}
              teamsMap={teamsMap}
              labels={{
                completed: tt("completed"),
                bracket: tt("bracket"),
                thirdPlace: tt("thirdPlace"),
              }}
            />
          ) : (
            <PlacementView
              matches={playoffMatches}
              teamsMap={teamsMap}
              labels={{
                completed: tt("completed"),
                playoffStage: tt("playoffStage"),
              }}
            />
          )}
        </div>
      )} */}

      {/* Matches Lists */}
      <div className="space-y-8">
        {/* Group Stage Matches */}
        {groupMatches.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">{tt("groupStage")}</h2>
            <div className="space-y-4">
              {groupMatches.map((match) => {
                const teamA = match.team_a_id ? teamsMap.get(match.team_a_id) : undefined;
                const teamB = match.team_b_id ? teamsMap.get(match.team_b_id) : undefined;
                const groupName = match.group_id
                  ? groups.find((g) => g.id === match.group_id)?.name
                  : null;

                return (
                  <div key={match.id}>
                    <GameMatchCard
                      href={match.game_id ? `/games/${match.game_id}` : undefined}
                      teamName={teamA?.name ?? "TBD"}
                      teamLogoUrl={teamA?.logo_url || null}
                      teamCountry={teamA?.country || null}
                      opponentName={teamB?.name ?? "TBD"}
                      opponentLogoUrl={teamB?.logo_url || null}
                      opponentCountry={teamB?.country || null}
                      teamScore={match.is_completed ? match.score_a : undefined}
                      opponentScore={match.is_completed ? match.score_b : undefined}
                      dateLabel={formatInBelgrade(match.match_date || "", locale, {
                        month: "short",
                        day: "numeric",
                      })}
                      timeLabel={formatInBelgrade(match.match_date || "", locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      resultLabel={match.is_completed ? tt("completed") : tt("scheduled")}
                      resultClassName={match.is_completed ? "bg-green-600/20 text-green-400" : "bg-muted text-muted-foreground"}
                      variant="tournament"
                      badges={
                        <>
                          {groupName && (
                            <Badge variant="outline" className="border-blue-500/20 text-blue-400 text-xs">
                              {groupName}
                            </Badge>
                          )}
                        </>
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Playoff Matches */}
        {playoffMatches.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">{tt("playoffStage")}</h2>
            <div className="space-y-4">
              {playoffMatches.map((match) => {
                const teamA = match.team_a_id ? teamsMap.get(match.team_a_id) : undefined;
                const teamB = match.team_b_id ? teamsMap.get(match.team_b_id) : undefined;

                return (
                  <div key={match.id}>
                    <GameMatchCard
                      href={match.game_id ? `/games/${match.game_id}` : undefined}
                      teamName={teamA?.name ?? "TBD"}
                      teamLogoUrl={teamA?.logo_url || null}
                      teamCountry={teamA?.country || null}
                      opponentName={teamB?.name ?? "TBD"}
                      opponentLogoUrl={teamB?.logo_url || null}
                      opponentCountry={teamB?.country || null}
                      teamScore={match.is_completed ? match.score_a : undefined}
                      opponentScore={match.is_completed ? match.score_b : undefined}
                      dateLabel={formatInBelgrade(match.match_date || "", locale, {
                        month: "short",
                        day: "numeric",
                      })}
                      timeLabel={formatInBelgrade(match.match_date || "", locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      resultLabel={match.is_completed ? tt("completed") : tt("scheduled")}
                      resultClassName={match.is_completed ? "bg-green-600/20 text-green-400" : "bg-muted text-muted-foreground"}
                      variant="tournament"
                      badges={
                        <>
                          {match.bracket_label && (
                            <Badge variant="outline" className="border-purple-500/20 text-purple-400 text-xs">
                              {match.bracket_label}
                            </Badge>
                          )}
                        </>
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
