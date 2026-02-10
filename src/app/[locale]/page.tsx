import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Trophy,
  Users,
  TrendingUp,
  ChevronRight,
  Swords,
  MapPin,
  Clock,
  Dumbbell,
} from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type { Game, TeamEvent, PlayerGameTotals } from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";
import type { GameResult } from "@/types/database";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const tg = await getTranslations("game");

  const supabase = await createClient();

  // Fetch all data in parallel
  const [
    { count: playerCount },
    { count: gameCount },
    { count: trainingCount },
    { data: nextGameData },
    { data: recentGamesData },
    { data: topScorersData },
    { data: upcomingEventsData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_approved", true),
    supabase
      .from("games")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("training_sessions")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("games")
      .select("*")
      .eq("result", "pending")
      .gte("game_date", new Date().toISOString())
      .order("game_date", { ascending: true })
      .limit(1),
    supabase
      .from("games")
      .select("*")
      .neq("result", "pending")
      .order("game_date", { ascending: false })
      .limit(5),
    supabase
      .from("player_game_totals")
      .select("*")
      .order("total_points", { ascending: false })
      .limit(5),
    supabase
      .from("events")
      .select("*")
      .eq("is_published", true)
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(3),
  ]);

  const nextGame = (nextGameData?.[0] ?? null) as Game | null;
  const recentGames = (recentGamesData ?? []) as Game[];
  const topScorers = (topScorersData ?? []) as PlayerGameTotals[];
  const upcomingEvents = (upcomingEventsData ?? []) as TeamEvent[];

  // Calculate win record
  const wins = recentGames.filter((g) => g.result === "win").length;
  const losses = recentGames.filter((g) => g.result === "loss").length;
  const draws = recentGames.filter((g) => g.result === "draw").length;

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden hero-gradient">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 50%, rgba(232,115,42,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(232,115,42,0.15) 0%, transparent 50%)",
            }}
          />
        </div>

        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Image
              src="/logo.png"
              alt="HC Propeleri"
              width={120}
              height={120}
              className="mx-auto mb-6 drop-shadow-[0_0_30px_rgba(232,115,42,0.3)]"
              priority
            />

            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4">
              {t("hero.title").split("Propeleri")[0]}
              <span className="text-primary">Propeleri</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8">
              {t("hero.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/schedule">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white font-semibold px-8"
                >
                  <CalendarDays className="mr-2 h-5 w-5" />
                  {t("hero.cta")}
                </Button>
              </Link>
              <Link href="/roster">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary/30 hover:bg-primary/10 hover:text-primary"
                >
                  <Users className="mr-2 h-5 w-5" />
                  {tc("roster")}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Stats bar */}
      <section className="border-b border-border/40 bg-card/30">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatItem
              icon={<Users className="h-5 w-5" />}
              value={String(playerCount ?? 0)}
              label={t("teamStats")}
            />
            <StatItem
              icon={<Swords className="h-5 w-5" />}
              value={String(gameCount ?? 0)}
              label={tc("games")}
            />
            <StatItem
              icon={<Trophy className="h-5 w-5" />}
              value={
                gameCount && gameCount > 0
                  ? `${wins}W-${losses}L-${draws}D`
                  : "--"
              }
              label={tc("stats")}
            />
            <StatItem
              icon={<Dumbbell className="h-5 w-5" />}
              value={String(trainingCount ?? 0)}
              label={tc("training")}
            />
          </div>
        </div>
      </section>

      {/* Main content grid */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Next Game Widget */}
          <Card className="md:col-span-2 lg:col-span-2 orange-glow border-primary/20 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Swords className="h-5 w-5 text-primary" />
                {t("nextGame")}
              </CardTitle>
              <Link href="/games">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-primary"
                >
                  {tc("viewAll")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {nextGame ? (
                <NextGameCard game={nextGame} locale={locale} homeLabel={tg("home")} awayLabel={tg("away")} />
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm mb-2">
                      {t("noUpcoming")}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Scorers Widget */}
          <Card className="border-border/40 card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-yellow-500" />
                {t("topScorers")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topScorers.length > 0 ? (
                <div className="space-y-3">
                  {topScorers.map((player, i) => (
                    <TopScorerRow key={player.player_id} player={player} rank={i + 1} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-6">
                  {tc("noData")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Results */}
          <Card className="md:col-span-2 lg:col-span-2 border-border/40 card-hover">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
                {t("recentResults")}
              </CardTitle>
              <Link href="/games">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-primary"
                >
                  {tc("viewAll")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentGames.length > 0 ? (
                <div className="space-y-3">
                  {recentGames.map((game) => (
                    <RecentGameRow key={game.id} game={game} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-6">
                  {tc("noData")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card className="border-border/40 card-hover">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-blue-400" />
                {t("upcoming")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-4">
                  {upcomingEvents.map((event) => (
                    <UpcomingEventRow key={event.id} event={event} locale={locale} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-6">
                  {tc("noData")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function NextGameCard({ game, locale, homeLabel, awayLabel }: { game: Game; locale: string; homeLabel: string; awayLabel: string }) {
  const date = new Date(game.game_date);
  const formattedDate = date.toLocaleDateString(locale === "sr" ? "sr-Latn" : locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const formattedTime = date.toLocaleTimeString(locale === "sr" ? "sr-Latn" : locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`/games/${game.id}`}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-4 group cursor-pointer">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <Image
              src="/logo.png"
              alt="HC Propeleri"
              width={56}
              height={56}
              className="mx-auto drop-shadow-[0_0_8px_rgba(232,115,42,0.3)]"
            />
            <div className="text-xs text-muted-foreground mt-1">Propeleri</div>
          </div>
          <div className="text-2xl font-bold text-muted-foreground">vs</div>
          <div className="text-center">
            <div className="text-3xl font-black">{game.opponent?.trim() || "TBD"}</div>
          </div>
        </div>
        <div className="flex flex-col items-center sm:items-end gap-1 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="capitalize">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formattedTime}</span>
          </div>
          {game.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{game.location}</span>
            </div>
          )}
          <Badge variant="outline" className="mt-1 border-primary/30 text-primary">
            {game.is_home ? homeLabel : awayLabel}
          </Badge>
        </div>
      </div>
    </Link>
  );
}

function TopScorerRow({
  player,
  rank,
}: {
  player: PlayerGameTotals;
  rank: number;
}) {
  return (
    <Link href={`/roster/${player.player_id}`}>
      <div className="flex items-center justify-between py-1.5 group cursor-pointer hover:bg-muted/30 rounded-md px-2 -mx-2 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-muted-foreground w-5">{rank}</span>
          <div>
            <span className="text-sm font-medium group-hover:text-primary transition-colors">
              {player.first_name} {player.last_name}
            </span>
            {player.jersey_number != null && (
              <span className="text-xs text-muted-foreground ml-1.5">
                #{player.jersey_number}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span title="Goals" className="font-bold">{player.total_goals}G</span>
          <span title="Assists" className="text-muted-foreground">{player.total_assists}A</span>
          <span title="Points" className="font-bold text-primary">{player.total_points}P</span>
        </div>
      </div>
    </Link>
  );
}

function RecentGameRow({ game }: { game: Game }) {
  const date = new Date(game.game_date);
  const formattedDate = date.toLocaleDateString("sr-Latn", {
    day: "numeric",
    month: "short",
  });

  const teamScore = game.is_home ? game.home_score : game.away_score;
  const opponentScore = game.is_home ? game.away_score : game.home_score;

  return (
    <Link href={`/games/${game.id}`}>
      <div className="flex items-center justify-between py-2 px-3 -mx-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className={`text-xs px-2 ${RESULT_COLORS[game.result as GameResult]}`}
          >
            {game.result === "win" ? "W" : game.result === "loss" ? "L" : "D"}
          </Badge>
          <Image src="/logo.png" alt="HC Propeleri" width={20} height={20} />
          <span className="text-sm">
            <span className="font-medium">Propeleri</span>
            <span className="text-muted-foreground"> vs </span>
            <span className="font-medium">{game.opponent}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tabular-nums">
            {teamScore}:{opponentScore}
          </span>
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>
      </div>
    </Link>
  );
}

function UpcomingEventRow({ event, locale }: { event: TeamEvent; locale: string }) {
  const title =
    locale === "ru" && event.title_ru
      ? event.title_ru
      : locale === "en" && event.title_en
        ? event.title_en
        : event.title;

  const date = event.event_date ? new Date(event.event_date) : null;
  const formattedDate = date
    ? date.toLocaleDateString(locale === "sr" ? "sr-Latn" : locale, {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <Link href={`/events/${event.id}`}>
      <div className="flex items-start gap-3 py-1 group cursor-pointer">
        {date && (
          <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex flex-col items-center justify-center">
            <span className="text-xs text-primary font-bold leading-none">
              {date.toLocaleDateString(locale === "sr" ? "sr-Latn" : locale, { month: "short" })}
            </span>
            <span className="text-lg font-black text-primary leading-none">
              {date.getDate()}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
            {title}
          </p>
          {event.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {event.location}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function StatItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-primary">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
