import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import { Swords, Award } from "lucide-react";
import type { Game, GameResult, Opponent, Team, Tournament } from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";
import { buildOpponentVisualLookup, resolveOpponentVisual } from "@/lib/utils/opponent-visual";
import { formatInBelgrade } from "@/lib/utils/datetime";

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

  const supabase = await createClient();
  const [gamesRes, tournamentsRes, opponentsRes, teamsRes] = await Promise.all([
    supabase.from("games").select("*").order("game_date", { ascending: false }),
    supabase
      .from("tournaments")
      .select("*")
      .order("start_date", { ascending: false }),
    supabase.from("opponents").select("*").eq("is_active", true),
    supabase.from("teams").select("*"),
  ]);

  const allGames = (gamesRes.data ?? []) as Game[];
  const allTournaments = (tournamentsRes.data ?? []) as Tournament[];
  const opponents = (opponentsRes.data ?? []) as Opponent[];
  const teams = (teamsRes.data ?? []) as Team[];
  const opponentVisuals = buildOpponentVisualLookup(teams, opponents);

  // Group games by tournament
  const tournamentMap = new Map<
    string,
    { tournament: Tournament; games: Game[] }
  >();
  const standaloneGames: Game[] = [];

  for (const game of allGames) {
    if (game.tournament_id) {
      if (!tournamentMap.has(game.tournament_id)) {
        const tournament = allTournaments.find(
          (t) => t.id === game.tournament_id
        );
        if (tournament) {
          tournamentMap.set(game.tournament_id, { tournament, games: [] });
        }
      }
      tournamentMap.get(game.tournament_id)?.games.push(game);
    } else {
      standaloneGames.push(game);
    }
  }

  const tournamentGroups = Array.from(tournamentMap.values()).sort(
    (a, b) =>
      new Date(b.games[0].game_date).getTime() -
      new Date(a.games[0].game_date).getTime()
  );

  const hasTournaments = tournamentGroups.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Swords className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">{tc("games")}</h1>
      </div>

      {allGames.length === 0 ? (
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
                  const visual = resolveOpponentVisual(game, opponentVisuals);
                  const dateLabel = formatInBelgrade(game.game_date, "sr-Latn", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                  const timeLabel = formatInBelgrade(game.game_date, "sr-Latn", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <GameMatchCard
                      key={game.id}
                      href={`/games/${game.id}`}
                      teamName="Propeleri"
                      opponentName={game.opponent}
                      opponentLogoUrl={visual.logoUrl}
                      opponentCountry={visual.country}
                      teamScore={game.result === "pending" ? undefined : game.is_home ? game.home_score : game.away_score}
                      opponentScore={game.result === "pending" ? undefined : game.is_home ? game.away_score : game.home_score}
                      dateLabel={dateLabel}
                      timeLabel={timeLabel}
                      location={game.location}
                      resultLabel={tg(`result.${game.result}`)}
                      resultClassName={RESULT_COLORS[game.result as GameResult]}
                      matchTimeLabel={tg("matchTime")}
                      variant="poster"
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
                const visual = resolveOpponentVisual(game, opponentVisuals);
                const dateLabel = formatInBelgrade(game.game_date, "sr-Latn", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
                const timeLabel = formatInBelgrade(game.game_date, "sr-Latn", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <GameMatchCard
                    key={game.id}
                    href={`/games/${game.id}`}
                    teamName="Propeleri"
                    opponentName={game.opponent}
                    opponentLogoUrl={visual.logoUrl}
                    opponentCountry={visual.country}
                    teamScore={game.result === "pending" ? undefined : game.is_home ? game.home_score : game.away_score}
                    opponentScore={game.result === "pending" ? undefined : game.is_home ? game.away_score : game.home_score}
                    dateLabel={dateLabel}
                    timeLabel={timeLabel}
                    location={game.location}
                    resultLabel={tg(`result.${game.result}`)}
                    resultClassName={RESULT_COLORS[game.result as GameResult]}
                    matchTimeLabel={tg("matchTime")}
                    variant="poster"
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
