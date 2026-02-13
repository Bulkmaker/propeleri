import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import { Swords, Award, Video } from "lucide-react";
import type { Game, GameResult, Team, Tournament } from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";
import { formatInBelgrade } from "@/lib/utils/datetime";

import { PageHeader } from "@/components/ui/page-header";

export const revalidate = 60;

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
  let error: string | null = null;

  try {
    const supabase = await createClient();
    const [gamesRes, tournamentsRes, teamsRes] = await Promise.all([
      supabase.from("games").select("*").order("game_date", { ascending: false }),
      supabase
        .from("tournaments")
        .select("*")
        .order("start_date", { ascending: false }),
      supabase.from("teams").select("*"),
    ]);

    if (gamesRes.error) throw gamesRes.error;
    if (tournamentsRes.error) throw tournamentsRes.error;
    if (teamsRes.error) throw teamsRes.error;

    allGames = (gamesRes.data ?? []) as Game[];
    allTournaments = (tournamentsRes.data ?? []) as Tournament[];
    teams = (teamsRes.data ?? []) as Team[];
  } catch (err: unknown) {
    console.error("Error loading games page data:", err);
    error = err instanceof Error ? err.message : "Failed to load games";
  }

  const teamMap = new Map(teams.map((t) => [t.id, t]));

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
              <Link href={`/tournaments/${tournament.id}`}>
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
                  return (
                    <GameMatchCard
                      key={game.id}
                      href={`/games/${game.id}`}
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
                      matchTimeLabel={tg("matchTime")}
                      variant="poster"
                      badges={game.youtube_url ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                          <Video className="h-3 w-3" />
                          Video
                        </Badge>
                      ) : undefined}
                    />
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
                return (
                  <GameMatchCard
                    key={game.id}
                    href={`/games/${game.id}`}
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
                    matchTimeLabel={tg("matchTime")}
                    variant="poster"
                    badges={game.youtube_url ? (
                      <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                        <Video className="h-3 w-3" />
                        Video
                      </Badge>
                    ) : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
