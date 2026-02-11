import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  Dumbbell,
  MapPin,
  Sparkles,
  Swords,
  Trophy,
  TrendingUp,
  Users,
} from "lucide-react";
import { Exo_2 } from "next/font/google";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type { Game, PlayerGameTotals, Team, TeamEvent } from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";
import type { GameResult } from "@/types/database";
import { TeamAvatar } from "@/components/matches/TeamAvatar";
import { formatInBelgrade } from "@/lib/utils/datetime";

const headlineFont = Exo_2({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
});

export const revalidate = 300; // ISR: revalidate every 5 minutes

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
    { data: teamsData },
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
      .select("id, opponent_team_id, game_date, home_score, away_score, is_home, result, location")
      .eq("result", "pending")
      .gte("game_date", new Date().toISOString())
      .order("game_date", { ascending: true })
      .limit(1),
    supabase
      .from("games")
      .select("id, opponent_team_id, game_date, home_score, away_score, is_home, result, location")
      .neq("result", "pending")
      .order("game_date", { ascending: false })
      .limit(5),
    supabase
      .from("player_game_totals")
      .select("player_id, first_name, last_name, total_goals, total_assists, total_points")
      .order("total_points", { ascending: false })
      .limit(6),
    supabase
      .from("events")
      .select("id, title, title_ru, title_en, event_date, location")
      .eq("is_published", true)
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(4),
    supabase.from("teams").select("id, name, logo_url, country, is_propeleri"),
  ]);

  const nextGame = (nextGameData?.[0] ?? null) as Game | null;
  const recentGames = (recentGamesData ?? []) as Game[];
  const topScorers = (topScorersData ?? []) as PlayerGameTotals[];
  const upcomingEvents = (upcomingEventsData ?? []) as TeamEvent[];
  const teams = (teamsData ?? []) as Team[];

  const nextGameOpponent = nextGame ? teams.find((t) => t.id === nextGame.opponent_team_id) : null;

  const wins = recentGames.filter((g) => g.result === "win").length;
  const losses = recentGames.filter((g) => g.result === "loss").length;
  const draws = recentGames.filter((g) => g.result === "draw").length;

  return (
    <div className="club-home">
      <div className="club-home__noise" aria-hidden />
      <div className="club-home__glow club-home__glow--orange" aria-hidden />
      <div className="club-home__glow club-home__glow--blue" aria-hidden />
      <div className="club-home__ice-lines" aria-hidden />
      <div className="club-home__brandmark" aria-hidden>
        <Image src="/logo.svg" alt="" fill sizes="(min-width: 1280px) 38vw, (min-width: 1024px) 44vw, 0px" className="object-contain object-right-top" />
      </div>
      <div className="club-home__vignette" aria-hidden />

      <section className="club-hero">
        <div className="container mx-auto px-4 pt-10 pb-12 md:pt-14 md:pb-16">
          <div className="club-hero__grid">
            <div className="club-hero__copy">
              <div className="club-hero__crest">
                <Image src="/logo.svg" alt="HC Propeleri crest" width={180} height={180} />
              </div>

              <p className="club-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                HC Propeleri · Novi Sad
              </p>

              <h1 className={`${headlineFont.className} club-hero__title`}>
                {t("hero.title").split("Propeleri")[0]}
                <span>Propeleri</span>
              </h1>

              <p className="club-hero__subtitle">{t("hero.subtitle")}</p>

              <div className="club-hero__actions">
                <Link href="/schedule">
                  <Button size="lg" className="club-btn-primary">
                    <CalendarDays className="mr-2 h-5 w-5" />
                    {t("hero.cta")}
                  </Button>
                </Link>
                <Link href="/roster">
                  <Button size="lg" variant="outline" className="club-btn-ghost">
                    <Users className="mr-2 h-5 w-5" />
                    {tc("roster")}
                  </Button>
                </Link>
              </div>

              <div className="club-hero__stats">
                <HeroStat
                  label={t("teamStats")}
                  value={String(playerCount ?? 0)}
                  icon={<Users className="h-4 w-4" />}
                />
                <HeroStat label={tc("games")} value={String(gameCount ?? 0)} icon={<Swords className="h-4 w-4" />} />
                <HeroStat label={tc("training")} value={String(trainingCount ?? 0)} icon={<Dumbbell className="h-4 w-4" />} />
                <HeroStat
                  label="W/L/D"
                  value={gameCount && gameCount > 0 ? `${wins}/${losses}/${draws}` : "--"}
                  icon={<TrendingUp className="h-4 w-4" />}
                />
              </div>
            </div>

            <div className="club-matchday">
              <div className="club-matchday__header">
                <div>
                  <p className="club-matchday__label">{t("nextGame")}</p>
                  <p className={`${headlineFont.className} club-matchday__title`}>{t("gameDay")}</p>
                </div>
                <Link href="/games" className="club-matchday__link">
                  {tc("viewAll")}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              {nextGame ? (
                <MatchdayPoster
                  game={nextGame}
                  localeTag={localeTag}
                  homeLabel={tg("home")}
                  awayLabel={tg("away")}
                  opponentName={nextGameOpponent?.name ?? nextGame.opponent ?? "Unknown"}
                  opponentLogoUrl={nextGameOpponent?.logo_url ?? null}
                  opponentCountry={nextGameOpponent?.country ?? null}
                />
              ) : (
                <div className="club-matchday__empty">{t("noUpcoming")}</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="club-pulse">
        <div className="container mx-auto px-4">
          <div className="club-pulse__wrap">
            <p className="club-pulse__title">
              <Trophy className="h-4 w-4" />
              {t("clubPulse")}
            </p>
            <div className="club-pulse__items">
              {recentGames.length > 0 ? (
                recentGames.map((game) => {
                  const opponent = teams.find((t) => t.id === game.opponent_team_id);
                  return (
                    <PulseResult
                      key={game.id}
                      game={game}
                      localeTag={localeTag}
                      opponentName={opponent?.name ?? game.opponent ?? "Unknown"}
                      opponentLogoUrl={opponent?.logo_url ?? null}
                      opponentCountry={opponent?.country ?? null}
                    />
                  );
                })
              ) : (
                <p className="club-pulse__empty">{tc("noData")}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 pt-10 pb-14">
        <div className="club-content-grid">
          <article className="club-section club-section--leaders">
            <header className="club-section__header">
              <h2 className={`${headlineFont.className} club-section__title`}>
                <Trophy className="h-5 w-5 text-yellow-400" />
                {t("topScorers")}
              </h2>
              <Link href="/stats" className="club-section__link">
                {tc("stats")}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </header>

            {topScorers.length > 0 ? (
              <div className="club-leaders-grid">
                {topScorers.slice(0, 3).map((player, index) => (
                  <TopScorerSpotlight key={player.player_id} player={player} rank={index + 1} />
                ))}
              </div>
            ) : (
              <p className="club-empty">{tc("noData")}</p>
            )}

            {topScorers.length > 3 && (
              <div className="club-leaders-list">
                {topScorers.slice(3).map((player, index) => (
                  <TopScorerLine key={player.player_id} player={player} rank={index + 4} />
                ))}
              </div>
            )}
          </article>

          <article className="club-section club-section--results">
            <header className="club-section__header">
              <h2 className={`${headlineFont.className} club-section__title`}>
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                {t("recentResults")}
              </h2>
              <Link href="/games" className="club-section__link">
                {tc("viewAll")}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </header>

            {recentGames.length > 0 ? (
              <div className="club-results-list">
                {recentGames.map((game) => {
                  const opponent = teams.find((t) => t.id === game.opponent_team_id);
                  return (
                    <ResultLine
                      key={game.id}
                      game={game}
                      localeTag={localeTag}
                      resultLabel={tg(`result.${game.result}`)}
                      opponentName={opponent?.name ?? "Unknown"}
                      opponentLogoUrl={opponent?.logo_url ?? null}
                      opponentCountry={opponent?.country ?? null}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="club-empty">{tc("noData")}</p>
            )}
          </article>

          <article className="club-section club-section--events">
            <header className="club-section__header">
              <h2 className={`${headlineFont.className} club-section__title`}>
                <CalendarDays className="h-5 w-5 text-sky-400" />
                {t("upcoming")}
              </h2>
              <Link href="/events" className="club-section__link">
                {tc("events")}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </header>

            {upcomingEvents.length > 0 ? (
              <div className="club-events-grid">
                {upcomingEvents.map((event) => (
                  <EventPoster key={event.id} event={event} locale={locale} />
                ))}
              </div>
            ) : (
              <p className="club-empty">{tc("noData")}</p>
            )}
          </article>
        </div>

        <section className="club-banner">
          <div>
            <p className="club-banner__eyebrow">{t("hero.title")}</p>
            <p className={`${headlineFont.className} club-banner__title`}>
              {t("heroTagline")}
            </p>
          </div>
          <div className="club-banner__actions">
            <Link href="/schedule">
              <Button className="club-btn-primary h-11">{t("hero.cta")}</Button>
            </Link>
            <Link href="/events">
              <Button variant="outline" className="club-btn-ghost h-11">
                {tc("events")}
              </Button>
            </Link>
          </div>
        </section>
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="club-hero-stat">
      <div className="club-hero-stat__icon">{icon}</div>
      <p className="club-hero-stat__value">{value}</p>
      <p className="club-hero-stat__label">{label}</p>
    </div>
  );
}

function MatchdayPoster({
  game,
  localeTag,
  homeLabel,
  awayLabel,
  opponentName,
  opponentLogoUrl,
  opponentCountry,
}: {
  game: Game;
  localeTag: string;
  homeLabel: string;
  awayLabel: string;
  opponentName: string;
  opponentLogoUrl: string | null;
  opponentCountry: string | null;
}) {
  const dateLabel = formatInBelgrade(game.game_date, localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = formatInBelgrade(game.game_date, localeTag, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`/games/${game.id}`} className="club-matchday__poster">
      <div className="club-matchday__teams">
        <div className="club-team-mark">
          <Image src="/logo.svg" alt="HC Propeleri" width={48} height={48} />
          <p>Propeleri</p>
        </div>
        <span>vs</span>
        <div className="club-team-mark">
          <TeamAvatar
            name={opponentName}
            logoUrl={opponentLogoUrl}
            country={opponentCountry}
            size="md"
            className="h-12 w-12 text-xl mx-auto"
          />
          <p>{opponentName}</p>
        </div>
      </div>

      <div className="club-matchday__meta">
        <Badge className="club-mini-badge">{game.is_home ? homeLabel : awayLabel}</Badge>
        <p>
          <CalendarDays className="h-4 w-4" />
          <span className="capitalize">{dateLabel}</span>
        </p>
        <p>
          <Clock className="h-4 w-4" />
          <span>{timeLabel}</span>
        </p>
        {game.location && (
          <p>
            <MapPin className="h-4 w-4" />
            <span>{game.location}</span>
          </p>
        )}
      </div>
    </Link>
  );
}

function PulseResult({
  game,
  localeTag,
  opponentName,
  opponentLogoUrl,
  opponentCountry,
}: {
  game: Game;
  localeTag: string;
  opponentName: string;
  opponentLogoUrl: string | null;
  opponentCountry: string | null;
}) {
  const dateLabel = formatInBelgrade(game.game_date, localeTag, {
    day: "numeric",
    month: "short",
  });
  const teamScore = game.is_home ? game.home_score : game.away_score;
  const opponentScore = game.is_home ? game.away_score : game.home_score;

  return (
    <Link href={`/games/${game.id}`} className="club-pulse-item">
      <Badge variant="secondary" className={`text-[11px] ${RESULT_COLORS[game.result as GameResult]}`}>
        {game.result === "win" ? "W" : game.result === "loss" ? "L" : "D"}
      </Badge>
      <span className="club-pulse-item__match flex items-center gap-2">
        <span>Propeleri vs</span>
        <TeamAvatar
          name={opponentName}
          logoUrl={opponentLogoUrl}
          country={opponentCountry}
          size="xs"
        />
        <span>{opponentName}</span>
      </span>
      <span className="club-pulse-item__score">
        {teamScore}:{opponentScore}
      </span>
      <span className="club-pulse-item__date">{dateLabel}</span>
    </Link>
  );
}

function TopScorerSpotlight({
  player,
  rank,
}: {
  player: PlayerGameTotals;
  rank: number;
}) {
  const accent = rank === 1 ? "club-scorer--gold" : rank === 2 ? "club-scorer--silver" : "club-scorer--bronze";

  return (
    <Link href={`/roster/${player.player_id}`} className={`club-scorer-card ${accent}`}>
      <p className="club-scorer-card__rank">#{rank}</p>
      <p className="club-scorer-card__name">
        {player.first_name} {player.last_name}
      </p>
      <div className="club-scorer-card__stats">
        <span>{player.total_goals}G</span>
        <span>{player.total_assists}A</span>
        <span>{player.total_points}P</span>
      </div>
    </Link>
  );
}

function TopScorerLine({
  player,
  rank,
}: {
  player: PlayerGameTotals;
  rank: number;
}) {
  return (
    <Link href={`/roster/${player.player_id}`} className="club-scorer-line">
      <span>{rank}</span>
      <p>
        {player.first_name} {player.last_name}
      </p>
      <strong>{player.total_points}P</strong>
    </Link>
  );
}

function ResultLine({
  game,
  localeTag,
  resultLabel,
  opponentName,
  opponentLogoUrl,
  opponentCountry,
}: {
  game: Game;
  localeTag: string;
  resultLabel: string;
  opponentName: string;
  opponentLogoUrl: string | null;
  opponentCountry: string | null;
}) {
  const dateLabel = formatInBelgrade(game.game_date, localeTag, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = formatInBelgrade(game.game_date, localeTag, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const teamScore = game.is_home ? game.home_score : game.away_score;
  const opponentScore = game.is_home ? game.away_score : game.home_score;

  return (
    <GameMatchCard
      href={`/games/${game.id}`}
      teamName="Propeleri"
      opponentName={opponentName}
      opponentLogoUrl={opponentLogoUrl}
      opponentCountry={opponentCountry}
      teamScore={teamScore}
      opponentScore={opponentScore}
      dateLabel={dateLabel}
      timeLabel={timeLabel}
      resultLabel={resultLabel}
      resultClassName={RESULT_COLORS[game.result as GameResult]}
      variant="compact"
    />
  );
}

function EventPoster({
  event,
  locale,
}: {
  event: TeamEvent;
  locale: string;
}) {
  const localeTag = toIntlLocale(locale);
  const date = event.event_date;
  const title =
    locale === "ru" && event.title_ru
      ? event.title_ru
      : locale === "en" && event.title_en
        ? event.title_en
        : event.title;

  return (
    <Link href={`/events/${event.id}`} className="club-event-poster">
      {date && (
        <div className="club-event-poster__date">
          <span>{formatInBelgrade(date, localeTag, { month: "short" })}</span>
          <strong>{formatInBelgrade(date, localeTag, { day: "numeric" })}</strong>
        </div>
      )}

      <p className="club-event-poster__title">{title}</p>

      {event.location && (
        <p className="club-event-poster__location">
          <MapPin className="h-3.5 w-3.5" />
          {event.location}
        </p>
      )}
    </Link>
  );
}
