import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrainingScoreView } from "@/components/training/TrainingScoreView";
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
import { AdminEditButton } from "@/components/shared/AdminEditButton";
import { POSITION_COLORS } from "@/lib/utils/constants";
import { parseTrainingMatchData } from "@/lib/utils/training-match";
import { formatPlayerName, formatPlayerNameWithNumber } from "@/lib/utils/player-name";
import { YouTubeEmbed } from "@/components/shared/YouTubeEmbed";
import { formatInBelgrade } from "@/lib/utils/datetime";
import type {
  PlayerPosition,
  Profile,
  TrainingFieldRole,
  TrainingSessionStatus,
  TrainingStats,
} from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("training_sessions")
    .select("session_date, title, location")
    .eq("slug", slug)
    .single();

  if (!session) return { title: "Training Not Found" };

  const dateStr = formatInBelgrade(
    session.session_date,
    locale === "sr" ? "sr-Latn" : locale,
    { day: "numeric", month: "long", year: "numeric" }
  );
  const title = session.title || t("trainingDetail.title", { date: dateStr });
  const description = t("trainingDetail.description", { date: dateStr });
  const path = `/training/${slug}`;

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

type TrainingStatWithPlayer = TrainingStats & {
  player: Profile | null;
};

type GroupedTeamPlayers = {
  forwards: TrainingStatWithPlayer[];
  defense: TrainingStatWithPlayer[];
  goalie: TrainingStatWithPlayer[];
  other: TrainingStatWithPlayer[];
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

function getDefaultRoleForPosition(position: PlayerPosition | null): TrainingFieldRole | null {
  if (position === "forward") return "forward";
  if (position === "defense") return "defense";
  return null;
}

function groupTeamPlayersByRole(
  players: TrainingStatWithPlayer[],
  goaliePlayerId: string | null | undefined,
  roleOverrides: Record<string, TrainingFieldRole>
): GroupedTeamPlayers {
  const grouped: GroupedTeamPlayers = {
    forwards: [],
    defense: [],
    goalie: [],
    other: [],
  };

  for (const stat of players) {
    const player = stat.player;
    if (!player) continue;

    if (goaliePlayerId && player.id === goaliePlayerId) {
      grouped.goalie.push(stat);
      continue;
    }

    const override = roleOverrides[player.id];
    const effectiveRole =
      override === "forward" || override === "defense"
        ? override
        : getDefaultRoleForPosition(player.position);

    if (effectiveRole === "forward") {
      grouped.forwards.push(stat);
      continue;
    }

    if (effectiveRole === "defense") {
      grouped.defense.push(stat);
      continue;
    }

    if (player.position === "goalie") {
      grouped.goalie.push(stat);
      continue;
    }

    grouped.other.push(stat);
  }

  return grouped;
}

export default async function TrainingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("training");
  const ts = await getTranslations("stats");
  const tc = await getTranslations("common");
  const tp = await getTranslations("positions");

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!session) notFound();

  const sessionId = session.id;
  const { data: statsRaw } = await supabase
    .from("training_stats")
    .select("*, player:profiles(*)")
    .eq("session_id", sessionId)
    .eq("attended", true)
    .order("goals", { ascending: false });
  const stats = (statsRaw ?? []) as TrainingStatWithPlayer[];
  const matchData = parseTrainingMatchData(session.match_data);

  const hasTeams = stats.some((s) => s.training_team);
  const teamA = stats.filter((s) => s.training_team === "team_a");
  const teamB = stats.filter((s) => s.training_team === "team_b");
  const noTeam = stats.filter((s) => !s.training_team);
  const roleOverrides = matchData?.role_overrides ?? {};
  const teamAGrouped = groupTeamPlayersByRole(
    teamA,
    matchData?.team_a_goalie_player_id,
    roleOverrides
  );
  const teamBGrouped = groupTeamPlayersByRole(
    teamB,
    matchData?.team_b_goalie_player_id,
    roleOverrides
  );

  const playerLookup = new Map<
    string,
    Pick<Profile, "id" | "first_name" | "last_name" | "nickname" | "jersey_number">
  >();
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
      .select("id, first_name, last_name, nickname, jersey_number")
      .in("id", missingPlayerIds);
    for (const player of missingPlayers ?? []) {
      playerLookup.set(player.id, player);
    }
  }

  function getPlayerName(playerId: string | null) {
    if (!playerId) return "—";
    const player = playerLookup.get(playerId);
    if (!player) return tc("unknownPlayer");
    return formatPlayerNameWithNumber(player);
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
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h1 className="text-3xl font-bold">{session.title || t("session")}</h1>
          <AdminEditButton
            href={`/admin/training/${session.id}`}
            variant="button"
          />
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
            {formatInBelgrade(session.session_date, "sr-Latn", {
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

      {session.youtube_url && (
        <Card className="border-border/40 mb-6">
          <CardHeader>
            <CardTitle>{t("sessionVideo")}</CardTitle>
          </CardHeader>
          <CardContent>
            <YouTubeEmbed url={session.youtube_url} title={session.title || t("session")} />
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
            <TrainingScoreView
              variant="panel"
              teamAScore={matchData.team_a_score}
              teamBScore={matchData.team_b_score}
              teamALabel={t("teamA")}
              teamBLabel={t("teamB")}
            />

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
              <CardContent className="space-y-3">
                <TeamRoleSection
                  title={tp("forward")}
                  players={teamAGrouped.forwards}
                  guestLabel={t("guest")}
                />
                <TeamRoleSection
                  title={tp("defense")}
                  players={teamAGrouped.defense}
                  guestLabel={t("guest")}
                />
                {teamAGrouped.other.length > 0 && (
                  <TeamRoleSection
                    title={t("noPosition")}
                    players={teamAGrouped.other}
                    guestLabel={t("guest")}
                  />
                )}
                <TeamRoleSection
                  title={tp("goalie")}
                  players={teamAGrouped.goalie}
                  guestLabel={t("guest")}
                />
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
              <CardContent className="space-y-3">
                <TeamRoleSection
                  title={tp("forward")}
                  players={teamBGrouped.forwards}
                  guestLabel={t("guest")}
                />
                <TeamRoleSection
                  title={tp("defense")}
                  players={teamBGrouped.defense}
                  guestLabel={t("guest")}
                />
                {teamBGrouped.other.length > 0 && (
                  <TeamRoleSection
                    title={t("noPosition")}
                    players={teamBGrouped.other}
                    guestLabel={t("guest")}
                  />
                )}
                <TeamRoleSection
                  title={tp("goalie")}
                  players={teamBGrouped.goalie}
                  guestLabel={t("guest")}
                />
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
                    <TeamPlayerCard key={s.id} stat={s} guestLabel={t("guest")} />
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
                        {s.player ? formatPlayerName(s.player) : "—"}
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

function TeamPlayerCard({
  stat,
  guestLabel,
}: {
  stat: TrainingStatWithPlayer;
  guestLabel: string;
}) {
  const player = stat.player;
  if (!player) return null;
  const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`;

  return (
    <div className="flex min-h-12 items-center gap-3 py-2 px-3 rounded-md bg-secondary/30">
      <Avatar className="h-8 w-8">
        <AvatarImage src={player.avatar_url ?? undefined} alt={`${player.first_name} ${player.last_name}`} />
        <AvatarFallback className="bg-secondary text-xs font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {player.jersey_number != null && (
            <span className="text-primary mr-1">#{player.jersey_number}</span>
          )}
          {formatPlayerName(player)}
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
        {stat.is_guest && (
          <span className="text-[9px] rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-amber-400 whitespace-nowrap">
            {guestLabel}
          </span>
        )}
      </div>
      <Badge className={`text-[10px] ${POSITION_COLORS[player.position as PlayerPosition]}`}>
        {player.position === "forward" ? "FW" : player.position === "defense" ? "DF" : "GK"}
      </Badge>
    </div>
  );
}

function TeamRoleSection({
  title,
  players,
  guestLabel,
}: {
  title: string;
  players: TrainingStatWithPlayer[];
  guestLabel: string;
}) {
  return (
    <div className="rounded-md border border-border/40 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {players.length}
        </Badge>
      </div>
      {players.length > 0 ? (
        <div className="space-y-2">
          {players.map((stat) => (
            <TeamPlayerCard key={stat.id} stat={stat} guestLabel={guestLabel} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/70">&mdash;</p>
      )}
    </div>
  );
}
