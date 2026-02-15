import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Target, TrendingUp, Dumbbell } from "lucide-react";
import { PlayerStatsTable } from "@/components/stats/PlayerStatsTable";
import type { PlayerStatRow } from "@/components/stats/PlayerStatsTable";
import type { PlayerGameTotals, PlayerTrainingTotals } from "@/types/database";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("stats.title"),
    description: t("stats.description"),
    alternates: {
      canonical: locale === "sr" ? "/stats" : `/${locale}/stats`,
      languages: { sr: "/stats", ru: "/ru/stats", en: "/en/stats" },
    },
    openGraph: { title: t("stats.title"), description: t("stats.description") },
  };
}

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

  const [gameStatsRes, trainingStatsRes, profilesRes] = await Promise.all([
    supabase.from("player_game_totals").select("*").order("total_points", { ascending: false }),
    supabase
      .from("player_training_totals")
      .select("*")
      .order("sessions_attended", { ascending: false }),
    supabase.from("profiles").select("id, avatar_url"),
  ]);

  const avatarMap = new Map(
    profilesRes.data?.map((p: { id: string; avatar_url: string | null }) => [p.id, p.avatar_url]) ?? []
  );

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

  const gameRows: PlayerStatRow[] = gamePlayers.map((p) => ({
    player_id: p.player_id,
    first_name: p.first_name,
    last_name: p.last_name,
    jersey_number: p.jersey_number,
    position: p.position,
    avatar_url: avatarMap.get(p.player_id) ?? null,
    appearances: p.games_played,
    goals: p.total_goals,
    assists: p.total_assists,
    points: p.total_points,
    penalty_minutes: p.total_pim,
  }));

  const trainingRows: PlayerStatRow[] = trainingPlayers.map((p) => ({
    player_id: p.player_id,
    first_name: p.first_name,
    last_name: p.last_name,
    jersey_number: null,
    position: null,
    avatar_url: avatarMap.get(p.player_id) ?? null,
    appearances: p.sessions_attended,
    goals: p.training_goals,
    assists: p.training_assists,
    points: p.training_goals + p.training_assists,
    penalty_minutes: 0,
  }));

  const statsLabels = {
    goals: t("goals"),
    assists: t("assists"),
    points: t("points"),
    penaltyMinutes: t("penaltyMinutes"),
    player: t("leaderboard"),
  };

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
                  <PlayerStatsTable
                    players={gameRows}
                    labels={{ ...statsLabels, appearances: t("gamesPlayed") }}
                    positionLabel={tp}
                  />
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
                  <PlayerStatsTable
                    players={trainingRows}
                    labels={{ ...statsLabels, appearances: t("sessionsAttended") }}
                    positionLabel={tp}
                    showPenalties={false}
                  />
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
