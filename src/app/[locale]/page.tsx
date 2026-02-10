import { getTranslations, setRequestLocale } from "next-intl/server";
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
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { Exo_2 } from "next/font/google";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type { Game, TeamEvent, PlayerGameTotals } from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";
import type { GameResult } from "@/types/database";

const headlineFont = Exo_2({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
});

function toIntlLocale(locale: string) {
  return locale === "sr" ? "sr-Latn" : locale;
}

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
  const localeTag = toIntlLocale(locale);

  const supabase = await createClient();

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
    supabase.from("games").select("*", { count: "exact", head: true }),
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

  const wins = recentGames.filter((g) => g.result === "win").length;
  const losses = recentGames.filter((g) => g.result === "loss").length;
  const draws = recentGames.filter((g) => g.result === "draw").length;

  return (
    <div className="home-shell flex flex-col">
      <div className="home-grid-overlay" aria-hidden />
      <div className="home-ice-grain" aria-hidden />
      <div className="home-ambient home-ambient--left" aria-hidden />
      <div className="home-ambient home-ambient--right" aria-hidden />

      <section className="relative border-b border-white/10">
        <div className="container relative mx-auto px-4 py-12 md:py-16">
          <div className="home-rink-illustration" aria-hidden>
            <Image
              src="/rink-illustration.svg"
              alt=""
              fill
              sizes="(min-width: 1024px) 42vw, 0px"
              className="object-contain object-right"
            />
          </div>

          <div className="grid items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="home-panel home-enter rounded-3xl p-6 md:p-8">
              <Badge className="mb-5 border border-primary/30 bg-primary/10 text-primary">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {t("teamStats")}
              </Badge>

              <h1
                className={`${headlineFont.className} text-4xl leading-none tracking-tight text-white md:text-6xl`}
              >
                {t("hero.title").split("Propeleri")[0]}
                <span className="home-gradient-text">Propeleri</span>
              </h1>

              <p className="mt-5 max-w-xl text-base text-slate-300 md:text-lg">
                {t("hero.subtitle")}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/schedule">
                  <Button
                    size="lg"
                    className="h-12 rounded-xl bg-primary px-7 text-white shadow-[0_12px_32px_rgba(232,115,42,0.35)] hover:bg-primary/90"
                  >
                    <CalendarDays className="mr-2 h-5 w-5" />
                    {t("hero.cta")}
                  </Button>
                </Link>
                <Link href="/roster">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-xl border-white/20 bg-white/5 px-7 text-white hover:bg-white/10"
                  >
                    <Users className="mr-2 h-5 w-5" />
                    {tc("roster")}
                  </Button>
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{tc("games")}</p>
                  <p className={`${headlineFont.className} mt-1 text-3xl text-white`}>
                    {gameCount ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{tc("training")}</p>
                  <p className={`${headlineFont.className} mt-1 text-3xl text-white`}>
                    {trainingCount ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">W/L/D</p>
                  <p className={`${headlineFont.className} mt-1 text-3xl text-white`}>
                    {gameCount && gameCount > 0 ? `${wins}/${losses}/${draws}` : "--"}
                  </p>
                </div>
              </div>
            </div>

            <Card className="home-panel home-enter home-enter-delay rounded-3xl border border-primary/25 bg-[#0d1629]/80 py-0">
              <CardHeader className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className={`${headlineFont.className} flex items-center gap-2 text-2xl text-white`}>
                    <Swords className="h-5 w-5 text-primary" />
                    {t("nextGame")}
                  </CardTitle>
                  <Link href="/games">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                      {tc("viewAll")}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {nextGame ? (
                  <NextGameSpotlight
                    game={nextGame}
                    localeTag={localeTag}
                    homeLabel={tg("home")}
                    awayLabel={tg("away")}
                  />
                ) : (
                  <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/10">
                    <p className="text-sm text-slate-300">{t("noUpcoming")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="container relative z-10 mx-auto -mt-6 px-4 pb-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatItem
            icon={<Users className="h-5 w-5" />}
            value={String(playerCount ?? 0)}
            label={t("teamStats")}
            hint="Roster"
            tone="orange"
          />
          <StatItem
            icon={<Swords className="h-5 w-5" />}
            value={String(gameCount ?? 0)}
            label={tc("games")}
            hint="Season"
            tone="blue"
          />
          <StatItem
            icon={<Trophy className="h-5 w-5" />}
            value={gameCount && gameCount > 0 ? `${wins}W-${losses}L-${draws}D` : "--"}
            label={tc("stats")}
            hint="Form"
            tone="emerald"
          />
          <StatItem
            icon={<Dumbbell className="h-5 w-5" />}
            value={String(trainingCount ?? 0)}
            label={tc("training")}
            hint="Sessions"
            tone="violet"
          />
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="home-panel home-feature-card home-feature-card--gold rounded-3xl border-white/10 py-0 lg:col-span-5">
            <CardHeader className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className={`${headlineFont.className} flex items-center gap-2 text-2xl text-white`}>
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  {t("topScorers")}
                </CardTitle>
                <Badge className="home-card-pill">{topScorers.length || 0} players</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {topScorers.length > 0 ? (
                <div className="space-y-2.5">
                  {topScorers.map((player, i) => (
                    <TopScorerRow key={player.player_id} player={player} rank={i + 1} />
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-300">{tc("noData")}</p>
              )}
            </CardContent>
          </Card>

          <Card className="home-panel home-feature-card home-feature-card--emerald rounded-3xl border-white/10 py-0 lg:col-span-7">
            <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <CardTitle className={`${headlineFont.className} flex items-center gap-2 text-2xl text-white`}>
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  {t("recentResults")}
                </CardTitle>
                <Badge className="home-card-pill">Last {recentGames.length}</Badge>
              </div>
              <Link href="/games">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  {tc("viewAll")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {recentGames.length > 0 ? (
                <div className="space-y-2.5">
                  {recentGames.map((game) => (
                    <RecentGameRow key={game.id} game={game} localeTag={localeTag} />
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-300">{tc("noData")}</p>
              )}
            </CardContent>
          </Card>

          <Card className="home-panel home-feature-card home-feature-card--sky rounded-3xl border-white/10 py-0 lg:col-span-12">
            <CardHeader className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <CardTitle className={`${headlineFont.className} flex items-center gap-2 text-2xl text-white`}>
                  <CalendarDays className="h-5 w-5 text-sky-400" />
                  {t("upcoming")}
                </CardTitle>
                <Badge className="home-card-pill">{upcomingEvents.length || 0} events</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {upcomingEvents.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {upcomingEvents.map((event) => (
                    <UpcomingEventCard key={event.id} event={event} locale={locale} />
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-300">{tc("noData")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function NextGameSpotlight({
  game,
  localeTag,
  homeLabel,
  awayLabel,
}: {
  game: Game;
  localeTag: string;
  homeLabel: string;
  awayLabel: string;
}) {
  const date = new Date(game.game_date);
  const formattedDate = date.toLocaleDateString(localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const formattedTime = date.toLocaleTimeString(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`/games/${game.id}`}>
      <div className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 transition-all duration-300 hover:border-primary/45 hover:shadow-[0_16px_38px_rgba(232,115,42,0.24)]">
        <div className="flex items-center justify-between gap-3">
          <Badge className="rounded-full border-primary/30 bg-primary/10 text-primary">
            {game.is_home ? homeLabel : awayLabel}
          </Badge>
          <span className="text-xs uppercase tracking-[0.16em] text-slate-300">{formattedTime}</span>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-center">
            <Image
              src="/logo.svg"
              alt="HC Propeleri"
              width={58}
              height={58}
              className="mx-auto drop-shadow-[0_0_14px_rgba(232,115,42,0.35)]"
            />
            <p className="mt-2 text-sm font-semibold text-white">Propeleri</p>
          </div>
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">vs</span>
          <div className="text-center">
            <p className="text-xl font-bold text-white md:text-2xl">{game.opponent?.trim() || "TBD"}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="capitalize">{formattedDate}</span>
          </div>
          {game.location && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{game.location}</span>
            </div>
          )}
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
  const rankTone =
    rank === 1
      ? "from-amber-300/30 to-amber-500/10 border-amber-300/40"
      : rank === 2
        ? "from-slate-200/20 to-slate-400/10 border-slate-300/30"
        : rank === 3
          ? "from-orange-300/20 to-orange-500/10 border-orange-300/30"
          : "from-primary/20 to-primary/5 border-primary/25";

  return (
    <Link href={`/roster/${player.player_id}`}>
      <div className="home-score-row group relative flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-white/[0.06]">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full border bg-gradient-to-br text-xs font-bold text-white ${rankTone}`}
          >
            {rank}
          </div>
          <div>
            <p className="text-sm font-medium text-white transition-colors group-hover:text-primary">
              {player.first_name} {player.last_name}
            </p>
            {player.jersey_number != null && (
              <p className="text-xs text-slate-400">#{player.jersey_number}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md border border-white/10 bg-black/25 px-2 py-1 font-semibold text-white">
            {player.total_goals}G
          </span>
          <span className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-slate-300">
            {player.total_assists}A
          </span>
          <span className="rounded-md border border-primary/35 bg-primary/15 px-2 py-1 font-semibold text-primary">
            {player.total_points}P
          </span>
        </div>
      </div>
    </Link>
  );
}

function RecentGameRow({
  game,
  localeTag,
}: {
  game: Game;
  localeTag: string;
}) {
  const date = new Date(game.game_date);
  const formattedDate = date.toLocaleDateString(localeTag, {
    day: "numeric",
    month: "short",
  });

  const teamScore = game.is_home ? game.home_score : game.away_score;
  const opponentScore = game.is_home ? game.away_score : game.home_score;

  return (
    <Link href={`/games/${game.id}`}>
      <div className="home-game-row group relative flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 transition-colors hover:border-primary/30 hover:bg-white/[0.06]">
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className={`text-xs ${RESULT_COLORS[game.result as GameResult]}`}
          >
            {game.result === "win" ? "W" : game.result === "loss" ? "L" : "D"}
          </Badge>
          <Image src="/logo.svg" alt="HC Propeleri" width={20} height={20} />
          <span className="text-sm text-slate-200">
            <span className="font-semibold text-white">Propeleri</span>
            <span className="text-slate-400"> vs </span>
            <span className="font-semibold text-white">{game.opponent}</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-lg border border-white/10 bg-black/35 px-2.5 py-1 text-lg font-bold tabular-nums text-white">
            {teamScore}:{opponentScore}
          </span>
          <span className="text-xs text-slate-400">{formattedDate}</span>
        </div>
      </div>
    </Link>
  );
}

function UpcomingEventCard({
  event,
  locale,
}: {
  event: TeamEvent;
  locale: string;
}) {
  const title =
    locale === "ru" && event.title_ru
      ? event.title_ru
      : locale === "en" && event.title_en
        ? event.title_en
        : event.title;

  const localeTag = toIntlLocale(locale);
  const date = event.event_date ? new Date(event.event_date) : null;

  return (
    <Link href={`/events/${event.id}`}>
      <div className="home-event-card group relative h-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent p-4 transition-colors hover:border-primary/35">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold text-white transition-colors group-hover:text-primary">
              {title}
            </p>
            {event.location && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-300">
                <MapPin className="h-3 w-3" />
                {event.location}
              </p>
            )}
          </div>

          {date && (
            <div className="shrink-0 rounded-xl border border-primary/25 bg-primary/10 px-2.5 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-primary">
                {date.toLocaleDateString(localeTag, { month: "short" })}
              </p>
              <p className="text-xl font-black leading-none text-primary">{date.getDate()}</p>
            </div>
          )}
        </div>

        {date && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span>{date.toLocaleDateString(localeTag, { weekday: "long" })}</span>
            <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-primary/80 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        )}
      </div>
    </Link>
  );
}

function StatItem({
  icon,
  value,
  label,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  hint: string;
  tone: "orange" | "blue" | "emerald" | "violet";
}) {
  const toneClass =
    tone === "orange"
      ? "home-stat--orange"
      : tone === "blue"
        ? "home-stat--blue"
        : tone === "emerald"
          ? "home-stat--emerald"
          : "home-stat--violet";

  return (
    <div className={`home-panel home-stat-card ${toneClass} rounded-2xl border border-white/10 bg-[#101b30]/85 px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.28)]`}>
      <p className="home-stat-hint">{hint}</p>
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        {icon}
      </div>
      <p className={`${headlineFont.className} text-3xl leading-none text-white`}>{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <div className="home-stat-bar" />
    </div>
  );
}
