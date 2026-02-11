import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Shield, Swords } from "lucide-react";
import { RESULT_COLORS, POSITION_COLORS } from "@/lib/utils/constants";
import type {
  GameResult,
  PlayerPosition,
  Profile,
  GameLineup,
  GameStats,
  SlotPosition,
  Team,
  Opponent,
  Tournament,
} from "@/types/database";
import HockeyRink from "@/components/games/HockeyRink";
import type { RinkPlayer } from "@/components/games/HockeyRink";
import { buildOpponentVisualLookup, resolveOpponentVisual } from "@/lib/utils/opponent-visual";
import { formatInBelgrade } from "@/lib/utils/datetime";

type GameLineupEntry = Omit<GameLineup, "line_number" | "slot_position" | "player"> & {
  line_number: number | null;
  slot_position: SlotPosition | null;
  player: Profile | null;
};

type GameStatEntry = Omit<GameStats, "player"> & {
  player: Profile | null;
};

type GoalEventInput = {
  scorer_player_id: string;
  assist_1_player_id: string;
  assist_2_player_id: string;
  period: GoalPeriod;
  goal_time: string;
};

type GoalPeriod = "1" | "2" | "3" | "OT" | "SO";
type GoaliePerformance = "excellent" | "good" | "average" | "bad";

type GoalieReportInput = {
  goalie_player_id: string;
  performance: GoaliePerformance;
};

type GameNotesPayload = {
  version: 1;
  goal_events: GoalEventInput[];
  goalie_report: GoalieReportInput | null;
};

// Goal period values for validation
const GOAL_PERIOD_VALUES: GoalPeriod[] = ["1", "2", "3", "OT", "SO"];

function normalizeGoalClock(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";

  const normalized = cleaned.replace(/\./g, ":");
  if (!/^\d{1,2}:\d{2}$/.test(normalized)) return "";

  const [minutesRaw, secondsRaw] = normalized.split(":");
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);
  if (Number.isNaN(minutes) || Number.isNaN(seconds) || seconds >= 60) return "";
  return `${minutes}:${secondsRaw}`;
}

function parseGameNotesPayload(notes: string | null): GameNotesPayload | null {
  if (!notes) return null;

  try {
    const parsed = JSON.parse(notes) as Partial<GameNotesPayload>;
    if (!parsed || typeof parsed !== "object") return null;

    const normalizedEvents = Array.isArray(parsed.goal_events)
      ? parsed.goal_events.map((event) => ({
        scorer_player_id: typeof event?.scorer_player_id === "string" ? event.scorer_player_id : "",
        assist_1_player_id:
          typeof event?.assist_1_player_id === "string" ? event.assist_1_player_id : "",
        assist_2_player_id:
          typeof event?.assist_2_player_id === "string" ? event.assist_2_player_id : "",
        period:
          typeof event?.period === "string" &&
            GOAL_PERIOD_VALUES.includes(event.period as GoalPeriod)
            ? (event.period as GoalPeriod)
            : "1",
        goal_time:
          typeof event?.goal_time === "string" ? normalizeGoalClock(event.goal_time) : "",
      }))
      : [];

    const goalieReport =
      parsed.goalie_report &&
        typeof parsed.goalie_report === "object" &&
        typeof parsed.goalie_report.goalie_player_id === "string" &&
        ["excellent", "good", "average", "bad"].includes(parsed.goalie_report.performance ?? "")
        ? {
          goalie_player_id: parsed.goalie_report.goalie_player_id,
          performance: parsed.goalie_report.performance as GoaliePerformance,
        }
        : null;

    return {
      version: 1,
      goal_events: normalizedEvents,
      goalie_report: goalieReport,
    };
  } catch {
    return null;
  }
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ locale: string; gameId: string }>;
}) {
  const { locale, gameId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("game");
  const ts = await getTranslations("stats");
  const tp = await getTranslations("positions");
  const tc = await getTranslations("common");

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (!game) notFound();
  const notes = parseGameNotesPayload(game.notes);

  const [lineupRes, statsRes, teamsRes, opponentsRes, tournamentsRes] = await Promise.all([
    supabase
      .from("game_lineups")
      .select("*, player:profiles(*)")
      .eq("game_id", gameId),
    supabase
      .from("game_stats")
      .select("*, player:profiles(*)")
      .eq("game_id", gameId)
      .order("goals", { ascending: false }),
    supabase.from("teams").select("*"),
    supabase.from("opponents").select("*").eq("is_active", true),
    supabase.from("tournaments").select("*"),
  ]);

  const lineup = (lineupRes.data ?? []) as GameLineupEntry[];
  const stats = (statsRes.data ?? []) as GameStatEntry[];
  const teams = (teamsRes.data ?? []) as Team[];
  const opponents = (opponentsRes.data ?? []) as Opponent[];
  const tournaments = (tournamentsRes.data ?? []) as Tournament[];
  const tournament = tournaments.find((t) => t.id === game.tournament_id);
  const goalEvents = notes?.goal_events ?? [];
  const goalieReport = notes?.goalie_report ?? null;
  const notePlayerIds = Array.from(
    new Set(
      goalEvents.flatMap((event) =>
        [event.scorer_player_id, event.assist_1_player_id, event.assist_2_player_id].filter(
          Boolean
        )
      )
    )
  );
  if (goalieReport?.goalie_player_id) {
    notePlayerIds.push(goalieReport.goalie_player_id);
  }

  const uniquePlayerIds = Array.from(new Set(notePlayerIds));
  const notePlayersRes =
    uniquePlayerIds.length > 0
      ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, jersey_number")
        .in("id", uniquePlayerIds)
      : { data: [] };

  const notePlayers = (notePlayersRes.data ?? []) as Pick<
    Profile,
    "id" | "first_name" | "last_name" | "jersey_number"
  >[];
  const playerLookup = new Map<
    string,
    Pick<Profile, "id" | "first_name" | "last_name" | "jersey_number">
  >();

  for (const player of notePlayers) {
    playerLookup.set(player.id, player);
  }
  for (const entry of lineup) {
    if (entry.player) {
      playerLookup.set(entry.player.id, entry.player);
    }
  }
  for (const entry of stats) {
    if (entry.player) {
      playerLookup.set(entry.player.id, entry.player);
    }
  }

  function getPlayerName(playerId: string) {
    const player = playerLookup.get(playerId);
    if (!player) return tc("unknownPlayer");
    const numberPrefix = player.jersey_number != null ? `#${player.jersey_number} ` : "";
    return `${numberPrefix}${player.first_name} ${player.last_name}`;
  }

  const opponentVisual = resolveOpponentVisual(
    game,
    buildOpponentVisualLookup(teams, opponents)
  );

  const dateLabel = formatInBelgrade(game.game_date, "sr-Latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeLabel = formatInBelgrade(game.game_date, "sr-Latn", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const teamScore = game.is_home ? game.home_score : game.away_score;
  const opponentScore = game.is_home ? game.away_score : game.home_score;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/games"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      <div className="mb-8">
        <GameMatchCard
          teamName="Propeleri"
          opponentName={game.opponent}
          opponentLogoUrl={opponentVisual.logoUrl}
          opponentCountry={opponentVisual.country}
          teamScore={game.result === "pending" ? undefined : teamScore}
          opponentScore={game.result === "pending" ? undefined : opponentScore}
          dateLabel={dateLabel}
          timeLabel={timeLabel}
          location={game.location}
          resultLabel={t(`result.${game.result}`)}
          resultClassName={RESULT_COLORS[game.result as GameResult]}
          matchTimeLabel={t("matchTime")}
          variant="poster"
          badges={
            <>
              {tournament && (
                <Badge variant="outline" className="text-xs mr-2 border-yellow-500/50 text-yellow-600 bg-yellow-500/10">
                  {tournament.name}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {game.is_home ? t("home") : t("away")}
              </Badge>
            </>
          }
        />
      </div>

      {/* Hockey Rink Visualization */}
      {lineup.length > 0 && (
        <Card className="border-border/40 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              {t("rinkView")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HockeyRink
              lineup={lineup.map((entry) => ({
                player_id: entry.player_id,
                designation: entry.designation,
                position_played: entry.position_played,
                line_number: entry.line_number,
                slot_position: entry.slot_position,
                player: entry.player,
              })) as RinkPlayer[]}
            />
          </CardContent>
        </Card>
      )}

      {(goalEvents.length > 0 || goalieReport) && (
        <Card className="border-border/40 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t("goalActions")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goalEvents.length > 0 && (
              <div className="space-y-2">
                {goalEvents.map((event, index) => (
                  <div
                    key={`${event.scorer_player_id}-${index}`}
                    className="rounded-md border border-border/40 p-3"
                  >
                    <p className="text-sm font-semibold">
                      {t("goalWithNumber", { number: index + 1, scorer: getPlayerName(event.scorer_player_id) })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t(`period.${event.period}`)}
                      {event.goal_time ? `, ${event.goal_time}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("assists")}:{" "}
                      {[event.assist_1_player_id, event.assist_2_player_id]
                        .filter(Boolean)
                        .map((playerId) => getPlayerName(playerId))
                        .join(", ") || tc("noData")}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {goalieReport && (
              <div className="rounded-md border border-border/40 p-3">
                <p className="text-sm font-semibold">
                  {t("goalie", { name: getPlayerName(goalieReport.goalie_player_id) })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("performanceRating", { rating: t(`goaliePerformance.${goalieReport.performance}`) })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lineup List */}
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              {t("lineup")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lineup.length > 0 ? (
              <LineupByLines lineup={lineup} t={t} tp={tp} />
            ) : (
              <p className="text-muted-foreground text-sm text-center py-6">
                {t("noLineup")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Player Stats */}
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-green-500" />
              {t("playerStats")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-center">{ts("goals")}</TableHead>
                    <TableHead className="text-center">{ts("assists")}</TableHead>
                    <TableHead className="text-center">{ts("points")}</TableHead>
                    <TableHead className="text-center">{ts("penaltyMinutes")}</TableHead>
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
                      <TableCell className="text-center">{s.goals}</TableCell>
                      <TableCell className="text-center">{s.assists}</TableCell>
                      <TableCell className="text-center font-bold text-primary">
                        {s.goals + s.assists}
                      </TableCell>
                      <TableCell className="text-center">{s.penalty_minutes}</TableCell>
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
      </div>
    </div>
  );
}

function LineupByLines({
  lineup,
  t,
  tp,
}: {
  lineup: GameLineupEntry[];
  t: Awaited<ReturnType<typeof getTranslations>>;
  tp: Awaited<ReturnType<typeof getTranslations>>;
}) {
  // Group by line_number
  const hasLines = lineup.some((e) => e.line_number !== null && e.slot_position !== null);
  if (!hasLines) {
    // Legacy flat list
    return (
      <div className="space-y-2">
        {lineup.map((entry) => (
          <LineupPlayerRow key={entry.id} entry={entry} tp={tp} />
        ))}
      </div>
    );
  }

  const goalies = lineup.filter((e) => e.slot_position === "GK");
  const lineGroups = new Map<number, GameLineupEntry[]>();
  for (const entry of lineup) {
    if (entry.slot_position === "GK") continue;
    const lineNum = entry.line_number ?? 1;
    if (!lineGroups.has(lineNum)) lineGroups.set(lineNum, []);
    lineGroups.get(lineNum)!.push(entry);
  }
  const sortedLineNums = [...lineGroups.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {goalies.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("goalies")}
          </p>
          <div className="space-y-1">
            {goalies.map((entry) => (
              <LineupPlayerRow key={entry.id} entry={entry} tp={tp} />
            ))}
          </div>
        </div>
      )}
      {sortedLineNums.map((lineNum) => (
        <div key={lineNum}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {t("line")} {lineNum}
          </p>
          <div className="space-y-1">
            {lineGroups.get(lineNum)!.map((entry) => (
              <LineupPlayerRow key={entry.id} entry={entry} tp={tp} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LineupPlayerRow({
  entry,
  tp,
}: {
  entry: GameLineupEntry;
  tp: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/50">
      <div className="flex items-center gap-3">
        <span className="text-primary font-bold text-sm">
          #{entry.player?.jersey_number ?? "-"}
        </span>
        <span className="text-sm font-medium">
          {entry.player?.first_name} {entry.player?.last_name}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {entry.slot_position && (
          <Badge variant="outline" className="text-[10px] font-mono">
            {entry.slot_position}
          </Badge>
        )}
        <Badge
          variant="secondary"
          className={`text-xs ${POSITION_COLORS[entry.position_played as PlayerPosition]}`}
        >
          {tp(entry.position_played)}
        </Badge>
        {entry.designation !== "player" && (
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            {entry.designation === "captain" ? "C" : "A"}
          </Badge>
        )}
      </div>
    </div>
  );
}
