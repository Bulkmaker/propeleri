import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, CalendarDays, MapPin, CheckCircle, XCircle, Swords } from "lucide-react";
import { POSITION_COLORS } from "@/lib/utils/constants";
import type {
  PlayerPosition,
  Profile,
  TrainingMatchData,
  TrainingSessionStatus,
  TrainingStats,
} from "@/types/database";

type TrainingStatWithPlayer = TrainingStats & {
  player: Profile | null;
};

function normalizeStatus(status: string | null | undefined): TrainingSessionStatus {
  if (status === "completed" || status === "canceled") return status;
  return "planned";
}

function statusBadgeClass(status: TrainingSessionStatus) {
  if (status === "completed") return "bg-green-500/10 text-green-500 border-green-500/20";
  if (status === "canceled") return "bg-red-500/10 text-red-500 border-red-500/20";
  return "bg-blue-500/10 text-blue-500 border-blue-500/20";
}

function parseTrainingMatchData(raw: unknown): TrainingMatchData | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<TrainingMatchData>;
  const events = Array.isArray(value.goal_events)
    ? value.goal_events
        .map((event) => {
          if (!event || typeof event !== "object") return null;
          const team: "team_a" | "team_b" | null =
            event.team === "team_b" ? "team_b" : event.team === "team_a" ? "team_a" : null;
          if (!team || typeof event.scorer_player_id !== "string") return null;
          return {
            team,
            scorer_player_id: event.scorer_player_id,
            assist_player_id:
              typeof event.assist_player_id === "string" ? event.assist_player_id : null,
          };
        })
        .filter(
          (
            event
          ): event is { team: "team_a" | "team_b"; scorer_player_id: string; assist_player_id: string | null } =>
            Boolean(event)
        )
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

export default async function TrainingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const { locale, sessionId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("training");
  const ts = await getTranslations("stats");
  const tc = await getTranslations("common");

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) notFound();

  const { data: statsRaw } = await supabase
    .from("training_stats")
    .select("*, player:profiles(*)")
    .eq("session_id", sessionId)
    .order("goals", { ascending: false });
  const stats = (statsRaw ?? []) as TrainingStatWithPlayer[];
  const matchData = parseTrainingMatchData(session.match_data);

  const date = new Date(session.session_date);

  const hasTeams = stats.some((s) => s.training_team);
  const teamA = stats.filter((s) => s.training_team === "team_a");
  const teamB = stats.filter((s) => s.training_team === "team_b");
  const noTeam = stats.filter((s) => !s.training_team);

  const playerLookup = new Map<string, Pick<Profile, "id" | "first_name" | "last_name" | "jersey_number">>();
  for (const stat of stats) {
    if (stat.player) {
      playerLookup.set(stat.player.id, stat.player);
    }
  }

  const matchPlayerIds = Array.from(
    new Set(
      [
        ...(matchData?.goal_events.map((event) => event.scorer_player_id) ?? []),
        ...(matchData?.goal_events.map((event) => event.assist_player_id).filter(Boolean) ?? []),
        matchData?.team_a_goalie_player_id,
        matchData?.team_b_goalie_player_id,
      ].filter(Boolean) as string[]
    )
  );
  const missingPlayerIds = matchPlayerIds.filter((playerId) => !playerLookup.has(playerId));
  if (missingPlayerIds.length > 0) {
    const { data: missingPlayers } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, jersey_number")
      .in("id", missingPlayerIds);
    for (const player of missingPlayers ?? []) {
      playerLookup.set(player.id, player);
    }
  }

  function getPlayerName(playerId: string | null) {
    if (!playerId) return "—";
    const player = playerLookup.get(playerId);
    if (!player) return "Игрок";
    const number = player.jersey_number != null ? `#${player.jersey_number} ` : "";
    return `${number}${player.first_name} ${player.last_name}`;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/training"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      {/* Session Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold">{session.title || t("session")}</h1>
          <Badge
            variant="outline"
            className={statusBadgeClass(normalizeStatus(session.status))}
          >
            {t(`status.${normalizeStatus(session.status)}`)}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            {date.toLocaleDateString("sr-Latn", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {session.location}
            </span>
          )}
        </div>
      </div>

      {session.notes && (
        <Card className="border-border/40 mb-6">
          <CardHeader>
            <CardTitle>{t("report")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.notes}</p>
          </CardContent>
        </Card>
      )}

      {matchData && (
        <Card className="border-border/40 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              {t("trainingMatch")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 items-center">
              <div className="rounded-md border border-border/60 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">{t("teamA")}</p>
                <p className="text-2xl font-bold">{matchData.team_a_score}</p>
              </div>
              <p className="text-center text-muted-foreground">:</p>
              <div className="rounded-md border border-border/60 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">{t("teamB")}</p>
                <p className="text-2xl font-bold">{matchData.team_b_score}</p>
              </div>
            </div>

            {(matchData.team_a_goalie_player_id || matchData.team_b_goalie_player_id) && (
              <div className="grid md:grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">{t("goalieTeamA")}: </span>
                  {getPlayerName(matchData.team_a_goalie_player_id)}
                </p>
                <p>
                  <span className="text-muted-foreground">{t("goalieTeamB")}: </span>
                  {getPlayerName(matchData.team_b_goalie_player_id)}
                </p>
              </div>
            )}

            {matchData.goal_events.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("goalsTimeline")}</p>
                {matchData.goal_events.map((event, idx) => (
                  <p key={`${event.team}-${event.scorer_player_id}-${idx}`} className="text-sm text-muted-foreground">
                    {idx + 1}. {event.team === "team_a" ? t("teamA") : t("teamB")} ·{" "}
                    {getPlayerName(event.scorer_player_id)}
                    {event.assist_player_id ? ` (${t("assist")}: ${getPlayerName(event.assist_player_id)})` : ""}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Teams Display */}
      {hasTeams && (teamA.length > 0 || teamB.length > 0) ? (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Team A - White */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-white border border-border" />
                  {t("teamA")}
                  <Badge variant="outline" className="ml-auto">{teamA.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teamA.map((s) => (
                    <TeamPlayerCard key={s.id} stat={s} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Team B - Dark */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-gray-600" />
                  {t("teamB")}
                  <Badge variant="outline" className="ml-auto">{teamB.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teamB.map((s) => (
                    <TeamPlayerCard key={s.id} stat={s} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* No team assigned */}
          {noTeam.length > 0 && (
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t("noTeam")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-2">
                  {noTeam.map((s) => (
                    <TeamPlayerCard key={s.id} stat={s} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Fallback: single table */
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>{t("attendance")} & {ts("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">{t("attendance")}</TableHead>
                    <TableHead className="text-center">{ts("goals")}</TableHead>
                    <TableHead className="text-center">{ts("assists")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-primary font-bold">
                        {s.player?.jersey_number ?? "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {s.player?.first_name} {s.player?.last_name}
                      </TableCell>
                      <TableCell className="text-center">
                        {s.attended ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">{s.goals}</TableCell>
                      <TableCell className="text-center">{s.assists}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-6">
                {tc("noData")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeamPlayerCard({ stat }: { stat: TrainingStatWithPlayer }) {
  const player = stat.player;
  if (!player) return null;
  const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-secondary/30">
      <Avatar className="h-8 w-8">
        <AvatarImage src={player.avatar_url ?? undefined} />
        <AvatarFallback className="bg-secondary text-xs font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {player.jersey_number != null && (
            <span className="text-primary mr-1">#{player.jersey_number}</span>
          )}
          {player.first_name} {player.last_name}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {stat.attended ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-500" />
        )}
        {stat.goals > 0 && <span className="text-primary font-bold">{stat.goals}G</span>}
        {stat.assists > 0 && <span>{stat.assists}A</span>}
      </div>
      <Badge className={`text-[10px] ${POSITION_COLORS[player.position as PlayerPosition]}`}>
        {player.position === "forward" ? "FW" : player.position === "defense" ? "DF" : "GK"}
      </Badge>
    </div>
  );
}
