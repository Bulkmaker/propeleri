import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import { Award, MapPin, Calendar, Trophy } from "lucide-react";
import { GroupStandingsTable } from "@/components/tournament/GroupStandingsTable";
import { computeGroupStandings } from "@/lib/utils/tournament";
import { formatInBelgrade } from "@/lib/utils/datetime";
import { PlayerStatsTable } from "@/components/stats/PlayerStatsTable";
import type { PlayerStatRow } from "@/components/stats/PlayerStatsTable";
import type {
  Team,
  TournamentTeam,
  TournamentGroup,
  TournamentGroupTeam,
  TournamentMatch,
  TournamentFormat,
} from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const supabase = await createClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name")
    .eq("id", id)
    .single();

  if (!tournament) return { title: "Tournament Not Found" };

  const title = t("tournament.title", { name: tournament.name });
  const description = t("tournament.description", { name: tournament.name });
  const path = `/tournaments/${id}`;

  return {
    title,
    description,
    alternates: {
      canonical: locale === "sr" ? path : `/${locale}${path}`,
      languages: { sr: path, ru: `/ru${path}`, en: `/en${path}` },
    },
    openGraph: { title, description },
  };
}

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
  const ts = await getTranslations("stats");
  const tp = await getTranslations("positions");

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

  // Determine border color for Propeleri matches based on result
  function getPropeleriBorderColor(match: TournamentMatch, teamA?: Team, teamB?: Team): string {
    if (!match.is_completed) return "";
    const isPropeleriA = teamA?.is_propeleri;
    const isPropeleriB = teamB?.is_propeleri;
    if (!isPropeleriA && !isPropeleriB) return "";
    const propeleriScore = isPropeleriA ? match.score_a : match.score_b;
    const opponentScore = isPropeleriA ? match.score_b : match.score_a;
    if (propeleriScore == null || opponentScore == null) return "";
    // Check shootout winner when scores are equal
    if (match.shootout_winner) {
      const propeleriIsTeamA = isPropeleriA;
      const propeleriWon = propeleriIsTeamA
        ? match.shootout_winner === "team_a"
        : match.shootout_winner === "team_b";
      return propeleriWon ? "border-green-500" : "border-red-500";
    }
    if (propeleriScore > opponentScore) return "border-green-500";
    if (propeleriScore < opponentScore) return "border-red-500";
    return "border-yellow-500";
  }

  const format = tournament.format as TournamentFormat;

  // Fetch player stats for tournament games
  const gameIds = matches
    .map((m) => m.game_id)
    .filter((gid): gid is string => gid !== null);

  let playerStats: PlayerStatRow[] = [];
  if (gameIds.length > 0) {
    const [lineupsRes, statsRes] = await Promise.all([
      supabase
        .from("game_lineups")
        .select(
          "game_id, player_id, player:profiles(first_name, last_name, jersey_number, position, avatar_url)"
        )
        .in("game_id", gameIds),
      supabase
        .from("game_stats")
        .select("game_id, player_id, goals, assists, penalty_minutes")
        .in("game_id", gameIds),
    ]);

    playerStats = aggregateTournamentStats(
      (lineupsRes.data ?? []) as RawTournamentLineupRow[],
      (statsRes.data ?? []) as RawTournamentStatRow[]
    );
  }

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

  const statsLabels = {
    appearances: ts("gamesPlayed"),
    goals: ts("goals"),
    assists: ts("assists"),
    points: ts("points"),
    penaltyMinutes: ts("penaltyMinutes"),
    player: tt("playerColumn"),
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

      <Tabs defaultValue="matches" className="space-y-6">
        <TabsList>
          <TabsTrigger value="matches">{tt("matches")}</TabsTrigger>
          <TabsTrigger value="stats">{tt("teamStats")}</TabsTrigger>
        </TabsList>

        <TabsContent value="matches">
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
                          borderColorClass={getPropeleriBorderColor(match, teamA, teamB)}
                          shootoutLabel={match.shootout_winner ? tt("shootoutShort") : undefined}
                          shootoutSide={match.shootout_winner === "team_a" ? "team" : match.shootout_winner === "team_b" ? "opponent" : undefined}
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
                          borderColorClass={getPropeleriBorderColor(match, teamA, teamB)}
                          shootoutLabel={match.shootout_winner ? tt("shootoutShort") : undefined}
                          shootoutSide={match.shootout_winner === "team_a" ? "team" : match.shootout_winner === "team_b" ? "opponent" : undefined}
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
        </TabsContent>

        <TabsContent value="stats">
          {playerStats.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{tt("noStatsYet")}</p>
            </div>
          ) : (
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle>{tt("teamStats")}</CardTitle>
              </CardHeader>
              <CardContent>
                <PlayerStatsTable
                  players={playerStats}
                  labels={statsLabels}
                  positionLabel={tp}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface RawPlayerProfile {
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  position: string | null;
  avatar_url: string | null;
}

interface RawTournamentLineupRow {
  game_id: string;
  player_id: string;
  player: RawPlayerProfile | RawPlayerProfile[] | null;
}

interface RawTournamentStatRow {
  game_id: string;
  player_id: string;
  goals: number;
  assists: number;
  penalty_minutes: number;
}

function aggregateTournamentStats(
  lineups: RawTournamentLineupRow[],
  stats: RawTournamentStatRow[]
): PlayerStatRow[] {
  // Build stats lookup: game_id+player_id -> stats
  const statsKey = (gameId: string, playerId: string) => `${gameId}:${playerId}`;
  const statsMap = new Map<string, RawTournamentStatRow>();
  for (const s of stats) {
    statsMap.set(statsKey(s.game_id, s.player_id), s);
  }

  // Aggregate from lineups (base) with stats joined
  const map = new Map<string, PlayerStatRow>();

  for (const row of lineups) {
    const p = Array.isArray(row.player) ? row.player[0] ?? null : row.player;
    const st = statsMap.get(statsKey(row.game_id, row.player_id));
    const existing = map.get(row.player_id);

    if (existing) {
      existing.appearances += 1;
      existing.goals += st?.goals ?? 0;
      existing.assists += st?.assists ?? 0;
      existing.penalty_minutes += st?.penalty_minutes ?? 0;
    } else {
      map.set(row.player_id, {
        player_id: row.player_id,
        first_name: p?.first_name ?? "",
        last_name: p?.last_name ?? "",
        jersey_number: p?.jersey_number ?? null,
        position: p?.position ?? null,
        avatar_url: p?.avatar_url ?? null,
        appearances: 1,
        goals: st?.goals ?? 0,
        assists: st?.assists ?? 0,
        points: 0,
        penalty_minutes: st?.penalty_minutes ?? 0,
      });
    }
  }

  const result = Array.from(map.values());
  for (const r of result) r.points = r.goals + r.assists;
  result.sort((a, b) => b.points - a.points || b.goals - a.goals);
  return result;
}
