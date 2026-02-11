import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { Trophy, Target, TrendingUp, Dumbbell } from "lucide-react";
import { POSITION_COLORS } from "@/lib/utils/constants";
import type { PlayerPosition, PlayerGameTotals, PlayerTrainingTotals } from "@/types/database";

export default async function StatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("stats");
  const tp = await getTranslations("positions");
  const tc = await getTranslations("common");

  const supabase = await createClient();

  const [gameStatsRes, trainingStatsRes] = await Promise.all([
    supabase.from("player_game_totals").select("*").order("total_points", { ascending: false }),
    supabase
      .from("player_training_totals")
      .select("*")
      .order("sessions_attended", { ascending: false }),
  ]);

  const gamePlayers = (gameStatsRes.data ?? []) as PlayerGameTotals[];
  const trainingPlayers = ((trainingStatsRes.data ?? []) as PlayerTrainingTotals[])
    .slice()
    .sort(
      (a, b) =>
        b.training_goals + b.training_assists - (a.training_goals + a.training_assists)
    );

  const topGameGoals = [...gamePlayers].sort((a, b) => b.total_goals - a.total_goals);
  const topGameAssists = [...gamePlayers].sort((a, b) => b.total_assists - a.total_assists);

  const topTrainingGoals = [...trainingPlayers].sort(
    (a, b) => b.training_goals - a.training_goals
  );
  const topTrainingAssists = [...trainingPlayers].sort(
    (a, b) => b.training_assists - a.training_assists
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
          <Trophy className="h-5 w-5 text-yellow-500" />
        </div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      <Tabs defaultValue="games" className="space-y-6">
        <TabsList>
          <TabsTrigger value="games">{tc("games")}</TabsTrigger>
          <TabsTrigger value="training">{tc("training")}</TabsTrigger>
        </TabsList>

        <TabsContent value="games">
          {gamePlayers.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{tc("noData")}</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TopPlayerCard
                  name={`${gamePlayers[0]?.first_name} ${gamePlayers[0]?.last_name}`}
                  number={gamePlayers[0]?.jersey_number}
                  points={gamePlayers[0]?.total_points}
                  goals={gamePlayers[0]?.total_goals}
                  assists={gamePlayers[0]?.total_assists}
                  icon={<Trophy className="h-5 w-5 text-yellow-500" />}
                  label={t("topPoints")}
                />
                {topGameGoals[0] && (
                  <TopPlayerCard
                    name={`${topGameGoals[0].first_name} ${topGameGoals[0].last_name}`}
                    number={topGameGoals[0].jersey_number}
                    points={topGameGoals[0].total_goals}
                    icon={<Target className="h-5 w-5 text-red-400" />}
                    label={t("topGoalScorers")}
                  />
                )}
                {topGameAssists[0] && (
                  <TopPlayerCard
                    name={`${topGameAssists[0].first_name} ${topGameAssists[0].last_name}`}
                    number={topGameAssists[0].jersey_number}
                    points={topGameAssists[0].total_assists}
                    icon={<TrendingUp className="h-5 w-5 text-blue-400" />}
                    label={t("topAssists")}
                  />
                )}
              </div>

              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle>{t("leaderboard")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-center">{t("gamesPlayed")}</TableHead>
                        <TableHead className="text-center">{t("goals")}</TableHead>
                        <TableHead className="text-center">{t("assists")}</TableHead>
                        <TableHead className="text-center">{t("points")}</TableHead>
                        <TableHead className="text-center">{t("penaltyMinutes")}</TableHead>
                        <TableHead className="text-center">{t("plusMinus")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gamePlayers.map((player, idx) => (
                        <TableRow key={player.player_id}>
                          <TableCell className="font-medium text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/roster/${player.player_id}`}
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                            >
                              <span className="text-primary font-bold text-sm">
                                {player.jersey_number ?? "-"}
                              </span>
                              <span className="font-medium">
                                {player.first_name} {player.last_name}
                              </span>
                              <Badge
                                variant="secondary"
                                className={`text-xs ml-1 ${POSITION_COLORS[player.position as PlayerPosition]}`}
                              >
                                {tp(player.position)}
                              </Badge>
                            </Link>
                          </TableCell>
                          <TableCell className="text-center">{player.games_played}</TableCell>
                          <TableCell className="text-center font-semibold">
                            {player.total_goals}
                          </TableCell>
                          <TableCell className="text-center">{player.total_assists}</TableCell>
                          <TableCell className="text-center font-bold text-primary">
                            {player.total_points}
                          </TableCell>
                          <TableCell className="text-center">{player.total_pim}</TableCell>
                          <TableCell className="text-center">
                            {player.total_plus_minus > 0
                              ? `+${player.total_plus_minus}`
                              : player.total_plus_minus}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="training">
          {trainingPlayers.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Dumbbell className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>{tc("noData")}</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TopPlayerCard
                  name={`${trainingPlayers[0]?.first_name} ${trainingPlayers[0]?.last_name}`}
                  points={
                    (trainingPlayers[0]?.training_goals ?? 0) +
                    (trainingPlayers[0]?.training_assists ?? 0)
                  }
                  goals={trainingPlayers[0]?.training_goals}
                  assists={trainingPlayers[0]?.training_assists}
                  icon={<Dumbbell className="h-5 w-5 text-yellow-500" />}
                  label={t("topPoints")}
                />
                {topTrainingGoals[0] && (
                  <TopPlayerCard
                    name={`${topTrainingGoals[0].first_name} ${topTrainingGoals[0].last_name}`}
                    points={topTrainingGoals[0].training_goals}
                    icon={<Target className="h-5 w-5 text-red-400" />}
                    label={t("topGoalScorers")}
                  />
                )}
                {topTrainingAssists[0] && (
                  <TopPlayerCard
                    name={`${topTrainingAssists[0].first_name} ${topTrainingAssists[0].last_name}`}
                    points={topTrainingAssists[0].training_assists}
                    icon={<TrendingUp className="h-5 w-5 text-blue-400" />}
                    label={t("topAssists")}
                  />
                )}
              </div>

              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle>{t("leaderboard")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-center">{t("gamesPlayed")}</TableHead>
                        <TableHead className="text-center">{t("goals")}</TableHead>
                        <TableHead className="text-center">{t("assists")}</TableHead>
                        <TableHead className="text-center">{t("points")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trainingPlayers.map((player, idx) => {
                        const points = player.training_goals + player.training_assists;
                        return (
                          <TableRow key={player.player_id}>
                            <TableCell className="font-medium text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/roster/${player.player_id}`}
                                className="font-medium hover:text-primary transition-colors"
                              >
                                {player.first_name} {player.last_name}
                              </Link>
                            </TableCell>
                            <TableCell className="text-center">{player.sessions_attended}</TableCell>
                            <TableCell className="text-center font-semibold">
                              {player.training_goals}
                            </TableCell>
                            <TableCell className="text-center">{player.training_assists}</TableCell>
                            <TableCell className="text-center font-bold text-primary">
                              {points}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TopPlayerCard({
  name,
  number,
  points,
  goals,
  assists,
  icon,
  label,
}: {
  name: string;
  number?: number | null;
  points: number;
  goals?: number;
  assists?: number;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Card className="border-border/40 orange-glow">
      <CardContent className="p-6 text-center">
        <div className="mb-2">{icon}</div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
          {label}
        </p>
        {number != null && <p className="text-3xl font-black text-primary">#{number}</p>}
        <p className="font-bold mt-1">{name}</p>
        <p className="text-4xl font-black text-primary mt-2">{points}</p>
        {goals !== undefined && assists !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            {goals}G + {assists}A
          </p>
        )}
      </CardContent>
    </Card>
  );
}
