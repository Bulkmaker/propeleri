import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { POSITION_COLORS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils";
import type { PlayerPosition, PlayerSeasonStats } from "@/types/database";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Trophy, TrendingUp } from "lucide-react";
import { formatPlayerName } from "@/lib/utils/player-name";
import { PlayerEditButton } from "@/components/players/PlayerEditButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; playerId: string }>;
}): Promise<Metadata> {
  const { locale, playerId } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const tp = await getTranslations({ locale, namespace: "positions" });

  const supabase = await createClient();
  const [{ data: player }, { data: gameTotals }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", playerId).single(),
    supabase
      .from("player_game_totals")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle(),
  ]);

  if (!player) return { title: "Player Not Found" };

  const name = `${player.first_name} ${player.last_name}`;
  const title = t("playerDetail.title", {
    number: player.jersey_number ?? "",
    name,
  });
  const description = t("playerDetail.description", {
    name,
    position: player.position ? tp(player.position) : "",
    goals: gameTotals?.total_goals ?? 0,
    assists: gameTotals?.total_assists ?? 0,
    points: gameTotals?.total_points ?? 0,
    games: gameTotals?.games_played ?? 0,
  });
  const path = `/roster/${playerId}`;

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

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; playerId: string }>;
}) {
  const { locale, playerId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("player");
  const ts = await getTranslations("stats");
  const tp = await getTranslations("positions");
  const tr = await getTranslations("roles");
  const tc = await getTranslations("common");

  const supabase = await createClient();

  const [
    { data: player },
    { data: seasonStats },
    { data: gameTotals },
    { data: trainingTotals },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", playerId)
      .single(),
    supabase
      .from("player_season_stats")
      .select("*")
      .eq("player_id", playerId),
    supabase
      .from("player_game_totals")
      .select("*")
      .eq("player_id", playerId)
      .single(),
    supabase
      .from("player_training_totals")
      .select("*")
      .eq("player_id", playerId)
      .single(),
  ]);

  if (!player) notFound();

  const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/roster"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      {/* Player Header */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
        <Avatar className="h-32 w-32 ring-4 ring-primary/20">
          <AvatarImage src={player.avatar_url ?? undefined} alt={`${player.first_name} ${player.last_name}`} />
          <AvatarFallback className="bg-secondary text-3xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="text-center md:text-left">
          {player.jersey_number != null && (
            <span className="text-5xl font-black text-primary mr-3">
              #{player.jersey_number}
            </span>
          )}
          <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
            <h1 className="text-3xl font-bold">
              {formatPlayerName(player)}
            </h1>
            <PlayerEditButton playerId={player.id} variant="button" />
          </div>
          <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
            <Badge className={POSITION_COLORS[player.position as PlayerPosition]}>
              {tp(player.position)}
            </Badge>
            {player.team_role !== "player" && (
              <Badge variant="outline" className={cn(
                player.team_role === "coach"
                  ? "border-green-500/30 text-green-400"
                  : "border-primary/30 text-primary"
              )}>
                {player.team_role === "captain"
                  ? tr("captain")
                  : player.team_role === "assistant_captain"
                    ? tr("assistantCaptain")
                    : tr("coach")}
              </Badge>
            )}
          </div>
          {(player.height || player.weight) && (
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {player.height && <span>{t("height")}: {player.height} cm</span>}
              {player.weight && <span>{t("weight")}: {player.weight} kg</span>}
            </div>
          )}
          {player.bio && (
            <p className="text-muted-foreground mt-3 max-w-md">{player.bio}</p>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={t("gamesPlayed")}
          value={gameTotals?.games_played ?? 0}
          icon={<Trophy className="h-4 w-4" />}
        />
        <StatCard
          label={ts("goals")}
          value={gameTotals?.total_goals ?? 0}
          highlight
        />
        <StatCard
          label={ts("assists")}
          value={gameTotals?.total_assists ?? 0}
        />
        <StatCard
          label={ts("points")}
          value={gameTotals?.total_points ?? 0}
          highlight
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Season Stats */}
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t("seasonStats")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {seasonStats && seasonStats.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ts("season")}</TableHead>
                    <TableHead className="text-center">{ts("gamesPlayed")}</TableHead>
                    <TableHead className="text-center">{ts("goals")}</TableHead>
                    <TableHead className="text-center">{ts("assists")}</TableHead>
                    <TableHead className="text-center">{ts("points")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(seasonStats as PlayerSeasonStats[]).map((s) => (
                    <TableRow key={s.season_id}>
                      <TableCell className="font-medium">{s.season_name}</TableCell>
                      <TableCell className="text-center">{s.games_played}</TableCell>
                      <TableCell className="text-center">{s.goals}</TableCell>
                      <TableCell className="text-center">{s.assists}</TableCell>
                      <TableCell className="text-center font-bold text-primary">
                        {s.points}
                      </TableCell>
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

        {/* Training Stats */}
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              {t("trainingStats")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trainingTotals ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {trainingTotals.sessions_attended}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("attendance")}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">
                    {trainingTotals.training_goals}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ts("goals")}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {trainingTotals.training_assists}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ts("assists")}
                  </p>
                </div>
              </div>
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

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className="border-border/40">
      <CardContent className="p-4 text-center">
        {icon && <div className="text-primary mb-1">{icon}</div>}
        <p className={`text-3xl font-bold ${highlight ? "text-primary" : ""}`}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
