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
import { Link } from "@/i18n/navigation";
import { Trophy, Target, TrendingUp } from "lucide-react";
import { POSITION_COLORS } from "@/lib/utils/constants";
import type { PlayerPosition, PlayerGameTotals } from "@/types/database";

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

  const { data: playerStats } = await supabase
    .from("player_game_totals")
    .select("*")
    .order("total_points", { ascending: false });

  const players = (playerStats ?? []) as PlayerGameTotals[];

  // Top scorers (by goals)
  const topGoals = [...players].sort((a, b) => b.total_goals - a.total_goals);
  // Top assists
  const topAssists = [...players].sort((a, b) => b.total_assists - a.total_assists);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
          <Trophy className="h-5 w-5 text-yellow-500" />
        </div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {players.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{tc("noData")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top 3 Highlights */}
          {players.length >= 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TopPlayerCard
                rank={1}
                name={`${players[0]?.first_name} ${players[0]?.last_name}`}
                number={players[0]?.jersey_number}
                points={players[0]?.total_points}
                goals={players[0]?.total_goals}
                assists={players[0]?.total_assists}
                icon={<Trophy className="h-5 w-5 text-yellow-500" />}
                label={t("topPoints")}
              />
              {topGoals[0] && (
                <TopPlayerCard
                  rank={1}
                  name={`${topGoals[0].first_name} ${topGoals[0].last_name}`}
                  number={topGoals[0].jersey_number}
                  points={topGoals[0].total_goals}
                  icon={<Target className="h-5 w-5 text-red-400" />}
                  label={t("topGoalScorers")}
                />
              )}
              {topAssists[0] && (
                <TopPlayerCard
                  rank={1}
                  name={`${topAssists[0].first_name} ${topAssists[0].last_name}`}
                  number={topAssists[0].jersey_number}
                  points={topAssists[0].total_assists}
                  icon={<TrendingUp className="h-5 w-5 text-blue-400" />}
                  label={t("topAssists")}
                />
              )}
            </div>
          )}

          {/* Full Leaderboard */}
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
                  {players.map((p, idx: number) => (
                    <TableRow key={p.player_id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/roster/${p.player_id}`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          <span className="text-primary font-bold text-sm">
                            {p.jersey_number ?? "-"}
                          </span>
                          <span className="font-medium">
                            {p.first_name} {p.last_name}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-xs ml-1 ${POSITION_COLORS[p.position as PlayerPosition]}`}
                          >
                            {tp(p.position)}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">{p.games_played}</TableCell>
                      <TableCell className="text-center font-semibold">
                        {p.total_goals}
                      </TableCell>
                      <TableCell className="text-center">{p.total_assists}</TableCell>
                      <TableCell className="text-center font-bold text-primary">
                        {p.total_points}
                      </TableCell>
                      <TableCell className="text-center">{p.total_pim}</TableCell>
                      <TableCell className="text-center">
                        {p.total_plus_minus > 0
                          ? `+${p.total_plus_minus}`
                          : p.total_plus_minus}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function TopPlayerCard({
  rank,
  name,
  number,
  points,
  goals,
  assists,
  icon,
  label,
}: {
  rank: number;
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
        {number != null && (
          <p className="text-3xl font-black text-primary">#{number}</p>
        )}
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
