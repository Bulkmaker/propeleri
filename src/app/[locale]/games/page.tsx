import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import { Swords, Award, Video } from "lucide-react";
import type { Game, GameResult, GoalEventInput, Profile, Team, Tournament, TournamentMatch } from "@/types/database";
import { RESULT_COLORS, RESULT_BORDER_COLORS } from "@/lib/utils/constants";
import { formatInBelgrade } from "@/lib/utils/datetime";
import { AdminEditButton } from "@/components/shared/AdminEditButton";
import { withYouTubeTimestamp } from "@/lib/utils/youtube";
import { GoalScorersFooter } from "@/components/matches/GoalScorersFooter";
import { NavigableCardLink } from "@/components/matches/NavigableCardLink";

import { PageHeader } from "@/components/ui/page-header";

// Minimal server-side parser for goal events from game.notes
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

function parseGoalEvents(notes: string | null): GoalEventInput[] {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.goal_events)) return [];
    return (parsed.goal_events as Record<string, unknown>[])
      .map((e) => ({
        scorer_player_id: typeof e?.scorer_player_id === "string" ? e.scorer_player_id : "",
        assist_1_player_id: typeof e?.assist_1_player_id === "string" ? e.assist_1_player_id : "",
        assist_2_player_id: typeof e?.assist_2_player_id === "string" ? e.assist_2_player_id : "",
        period: "1" as const,
        goal_time: typeof e?.goal_time === "string" ? normalizeGoalClock(e.goal_time) : "",
        video_url: typeof e?.video_url === "string" ? e.video_url.trim() : "",
      }))
      .filter((e) => Boolean(e.scorer_player_id));
  } catch {
    return [];
  }
}

function buildGoalFooter(
  events: GoalEventInput[],
  playerMap: Map<string, Pick<Profile, "id" | "first_name" | "last_name" | "nickname" | "jersey_number">>,
  gameVideoUrl: string | null,
) {
  if (events.length === 0) return null;

  const getName = (id: string) => {
    const p = playerMap.get(id);
    if (!p) return null;
    const num = p.jersey_number != null ? `#${p.jersey_number} ` : "";
    return `${num}${p.nickname || p.last_name || p.first_name}`;
  };

  const lines = events
    .map((e) => {
      const scorer = getName(e.scorer_player_id);
      if (!scorer) return null;
      const assists = [e.assist_1_player_id, e.assist_2_player_id]
        .filter(Boolean)
        .map((id) => getName(id))
        .filter(Boolean);
      const goalTime = e.goal_time || "";
      const videoUrl = e.video_url
        ? e.video_url
        : gameVideoUrl && goalTime
          ? withYouTubeTimestamp(gameVideoUrl, goalTime)
          : "";
      return { scorer, assists, goalTime, videoUrl };
    })
    .filter(Boolean) as { scorer: string; assists: string[]; goalTime: string; videoUrl: string }[];

  if (lines.length === 0) return null;
  return lines;
}

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("games.title"),
    description: t("games.description"),
    alternates: {
      canonical: locale === "sr" ? "/games" : `/${locale}/games`,
      languages: { sr: "/games", ru: "/ru/games", en: "/en/games" },
    },
    openGraph: { title: t("games.title"), description: t("games.description") },
  };
}

export default async function GamesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tc = await getTranslations("common");
  const tt = await getTranslations("tournament");
  const tg = await getTranslations("game");

  let allGames: Game[] = [];
  let allTournaments: Tournament[] = [];
  let teams: Team[] = [];
  let tmatches: Pick<TournamentMatch, "game_id" | "shootout_winner" | "team_a_id" | "team_b_id">[] = [];
  let error: string | null = null;

  try {
    const supabase = await createClient();
    const [gamesRes, tournamentsRes, teamsRes, tmatchesRes] = await Promise.all([
      supabase.from("games").select("*").order("game_date", { ascending: false }),
      supabase
        .from("tournaments")
        .select("*")
        .order("start_date", { ascending: false }),
      supabase.from("teams").select("*"),
      supabase
        .from("tournament_matches")
        .select("game_id, shootout_winner, team_a_id, team_b_id")
        .not("game_id", "is", null),
    ]);

    if (gamesRes.error) throw gamesRes.error;
    if (tournamentsRes.error) throw tournamentsRes.error;
    if (teamsRes.error) throw teamsRes.error;

    allGames = (gamesRes.data ?? []) as Game[];
    allTournaments = (tournamentsRes.data ?? []) as Tournament[];
    teams = (teamsRes.data ?? []) as Team[];
    tmatches = (tmatchesRes.data ?? []) as Pick<TournamentMatch, "game_id" | "shootout_winner" | "team_a_id" | "team_b_id">[];
  } catch (err: unknown) {
    console.error("Error loading games page data:", err);
    error = err instanceof Error ? err.message : "Failed to load games";
  }

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // Build shootout map: game_id -> "team" | "opponent" (relative to Propeleri)
  const shootoutSideMap = new Map<string, "team" | "opponent">();
  for (const tm of tmatches) {
    if (!tm.game_id || !tm.shootout_winner) continue;
    const teamA = tm.team_a_id ? teamMap.get(tm.team_a_id) : undefined;
    const propIsTeamA = teamA?.is_propeleri ?? false;
    if (propIsTeamA) {
      shootoutSideMap.set(tm.game_id, tm.shootout_winner === "team_a" ? "team" : "opponent");
    } else {
      shootoutSideMap.set(tm.game_id, tm.shootout_winner === "team_b" ? "team" : "opponent");
    }
  }

  // Parse goal events and load scorer profiles
  const gameGoalEvents = new Map<string, GoalEventInput[]>();
  const allPlayerIds = new Set<string>();
  for (const game of allGames) {
    const events = parseGoalEvents(game.notes);
    if (events.length > 0) {
      gameGoalEvents.set(game.id, events);
      for (const e of events) {
        if (e.scorer_player_id) allPlayerIds.add(e.scorer_player_id);
        if (e.assist_1_player_id) allPlayerIds.add(e.assist_1_player_id);
        if (e.assist_2_player_id) allPlayerIds.add(e.assist_2_player_id);
      }
    }
  }

  const playerMap = new Map<string, Pick<Profile, "id" | "first_name" | "last_name" | "nickname" | "jersey_number">>();
  if (allPlayerIds.size > 0 && !error) {
    try {
      const supabase = await createClient();
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, nickname, jersey_number")
        .in("id", Array.from(allPlayerIds));
      for (const p of (profilesData ?? []) as Pick<Profile, "id" | "first_name" | "last_name" | "nickname" | "jersey_number">[]) {
        playerMap.set(p.id, p);
      }
    } catch {
      // Non-critical, goals just won't show names
    }
  }

  // Group games by tournament
  const tournamentLookup = new Map(allTournaments.map((t) => [t.id, t]));
  const tournamentGroupMap = new Map<
    string,
    { tournament: Tournament; games: Game[] }
  >();
  const standaloneGames: Game[] = [];

  for (const game of allGames) {
    if (game.tournament_id) {
      if (!tournamentGroupMap.has(game.tournament_id)) {
        const tournament = tournamentLookup.get(game.tournament_id);
        if (tournament) {
          tournamentGroupMap.set(game.tournament_id, { tournament, games: [] });
        }
      }
      tournamentGroupMap.get(game.tournament_id)?.games.push(game);
    } else {
      standaloneGames.push(game);
    }
  }

  const tournamentGroups = Array.from(tournamentGroupMap.values()).sort(
    (a, b) =>
      new Date(b.games[0].game_date).getTime() -
      new Date(a.games[0].game_date).getTime()
  );

  const hasTournaments = tournamentGroups.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title={tc("games")} icon={Swords} />

      {error ? (
        <div className="flex flex-col items-center justify-center py-20 text-destructive text-center">
          <p className="mb-4">{error}</p>
          <Link href="/games">
            <Button variant="outline" className="border-destructive/30 hover:bg-destructive/10">
              {tc("retry")}
            </Button>
          </Link>
        </div>
      ) : allGames.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Swords className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{tc("noData")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Tournament groups */}
          {tournamentGroups.map(({ tournament, games }) => (
            <div key={tournament.id} className="space-y-3">
              <Link href={`/tournaments/${tournament.slug}`}>
                <div className="flex items-center gap-3 px-3 py-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/10 transition-colors">
                  <Award className="h-5 w-5 text-yellow-400 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-sm">{tournament.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {tournament.location && `${tournament.location} | `}
                      {tournament.start_date} — {tournament.end_date}
                    </p>
                  </div>
                  <Badge className="ml-auto bg-yellow-500/20 text-yellow-400 text-xs shrink-0">
                    {games.length} {tt("games").toLowerCase()}
                  </Badge>
                </div>
              </Link>
              <div className="mt-3 space-y-3">
                {games.map((game) => {
                  const opponent = game.opponent_team_id ? teamMap.get(game.opponent_team_id) : undefined;
                  const opponentName = opponent?.name ?? game.opponent ?? tg("unknownOpponent");

                  const dateLabel = formatInBelgrade(game.game_date, locale, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                  const timeLabel = formatInBelgrade(game.game_date, locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const goals = buildGoalFooter(gameGoalEvents.get(game.id) ?? [], playerMap, game.youtube_url);
                  return (
                    <NavigableCardLink
                      key={game.id}
                      href={`/games/${game.slug}`}
                      className="relative max-w-4xl mx-auto"
                    >
                      <GameMatchCard
                        teamName={tt("propeleri")}
                        opponentName={opponentName}
                        opponentLogoUrl={opponent?.logo_url || null}
                        opponentCountry={opponent?.country || null}
                        teamScore={game.result === "pending" ? undefined : game.is_home ? game.home_score : game.away_score}
                        opponentScore={game.result === "pending" ? undefined : game.is_home ? game.away_score : game.home_score}
                        dateLabel={dateLabel}
                        timeLabel={timeLabel}
                        location={game.location}
                        resultLabel={tg(`result.${game.result}`)}
                        resultClassName={RESULT_COLORS[game.result as GameResult]}
                        borderColorClass={RESULT_BORDER_COLORS[game.result as GameResult]}
                        matchTimeLabel={tg("matchTime")}
                        shootoutLabel={shootoutSideMap.has(game.id) ? tt("shootoutShort") : undefined}
                        shootoutSide={shootoutSideMap.get(game.id)}
                        variant="poster"
                        badges={game.youtube_url ? (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                            <Video className="h-3 w-3" />
                            Video
                          </Badge>
                        ) : undefined}
                        footer={goals ? <GoalScorersFooter items={goals} videoLabel={tg("goalVideo")} /> : undefined}
                      />
                      <AdminEditButton
                        href={`/admin/games/${game.id}`}
                        className="absolute top-2 right-2 z-10"
                      />
                    </NavigableCardLink>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Standalone games */}
          {standaloneGames.length > 0 && (
            <div className="space-y-5">
              {hasTournaments && (
                <h2 className="text-sm font-semibold text-muted-foreground px-2 pt-1">
                  {tt("standalone")}
                </h2>
              )}
              {standaloneGames.map((game) => {
                const opponent = game.opponent_team_id ? teamMap.get(game.opponent_team_id) : undefined;
                const opponentName = opponent?.name ?? game.opponent ?? tg("unknownOpponent");

                const dateLabel = formatInBelgrade(game.game_date, locale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
                const timeLabel = formatInBelgrade(game.game_date, locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const goals = buildGoalFooter(gameGoalEvents.get(game.id) ?? [], playerMap, game.youtube_url);
                return (
                  <NavigableCardLink
                    key={game.id}
                    href={`/games/${game.slug}`}
                    className="relative max-w-4xl mx-auto"
                  >
                    <GameMatchCard
                      teamName={tt("propeleri")}
                      opponentName={opponentName}
                      opponentLogoUrl={opponent?.logo_url || null}
                      opponentCountry={opponent?.country || null}
                      teamScore={game.result === "pending" ? undefined : game.is_home ? game.home_score : game.away_score}
                      opponentScore={game.result === "pending" ? undefined : game.is_home ? game.away_score : game.home_score}
                      dateLabel={dateLabel}
                      timeLabel={timeLabel}
                      location={game.location}
                      resultLabel={tg(`result.${game.result}`)}
                      resultClassName={RESULT_COLORS[game.result as GameResult]}
                      borderColorClass={RESULT_BORDER_COLORS[game.result as GameResult]}
                      matchTimeLabel={tg("matchTime")}
                      shootoutLabel={shootoutSideMap.has(game.id) ? tt("shootoutShort") : undefined}
                      shootoutSide={shootoutSideMap.get(game.id)}
                      variant="poster"
                      badges={game.youtube_url ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                          <Video className="h-3 w-3" />
                          Video
                        </Badge>
                      ) : undefined}
                      footer={goals ? <GoalScorersFooter items={goals} videoLabel={tg("goalVideo")} /> : undefined}
                    />
                    <AdminEditButton
                      href={`/admin/games/${game.id}`}
                      className="absolute top-2 right-2 z-10"
                    />
                  </NavigableCardLink>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
