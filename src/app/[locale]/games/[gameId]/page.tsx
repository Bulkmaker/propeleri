import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, MapPin, CalendarDays, Swords } from "lucide-react";
import { RESULT_COLORS, POSITION_COLORS } from "@/lib/utils/constants";
import type {
  GameResult,
  PlayerPosition,
  Profile,
  GameLineup,
  GameStats,
  SlotPosition,
} from "@/types/database";
import HockeyRink from "@/components/games/HockeyRink";
import type { RinkPlayer } from "@/components/games/HockeyRink";

type GameLineupEntry = Omit<GameLineup, "line_number" | "slot_position" | "player"> & {
  line_number: number | null;
  slot_position: SlotPosition | null;
  player: Profile | null;
};

type GameStatEntry = Omit<GameStats, "player"> & {
  player: Profile | null;
};

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

  const { data: lineupRaw } = await supabase
    .from("game_lineups")
    .select("*, player:profiles(*)")
    .eq("game_id", gameId);
  const lineup = (lineupRaw ?? []) as GameLineupEntry[];

  const { data: statsRaw } = await supabase
    .from("game_stats")
    .select("*, player:profiles(*)")
    .eq("game_id", gameId)
    .order("goals", { ascending: false });
  const stats = (statsRaw ?? []) as GameStatEntry[];

  const date = new Date(game.game_date);

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/games"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      {/* Score Header */}
      <Card className="border-primary/20 orange-glow mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <CalendarDays className="h-4 w-4" />
              {date.toLocaleDateString("sr-Latn", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {game.location && (
                <>
                  <span className="mx-2">|</span>
                  <MapPin className="h-4 w-4" />
                  {game.location}
                </>
              )}
            </div>

            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-xl font-bold">Propeleri</p>
                <Badge variant="outline" className="mt-1 text-xs">
                  {game.is_home ? t("home") : t("away")}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-5xl font-black">
                  {game.is_home ? game.home_score : game.away_score}
                </span>
                <span className="text-2xl text-muted-foreground">:</span>
                <span className="text-5xl font-black">
                  {game.is_home ? game.away_score : game.home_score}
                </span>
              </div>

              <div className="text-center">
                <p className="text-xl font-bold">{game.opponent}</p>
                <Badge className={`mt-1 text-xs ${RESULT_COLORS[game.result as GameResult]}`}>
                  {t(`result.${game.result}`)}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                player: entry.player,
              })) as RinkPlayer[]}
            />
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
