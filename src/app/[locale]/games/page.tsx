import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords, MapPin, Award } from "lucide-react";
import type { Game, GameResult, Tournament } from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";

export default async function GamesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("game");
  const tc = await getTranslations("common");
  const tt = await getTranslations("tournament");

  const supabase = await createClient();
  const [gamesRes, tournamentsRes] = await Promise.all([
    supabase.from("games").select("*").order("game_date", { ascending: false }),
    supabase
      .from("tournaments")
      .select("*")
      .order("start_date", { ascending: false }),
  ]);

  const allGames = (gamesRes.data ?? []) as Game[];
  const allTournaments = (tournamentsRes.data ?? []) as Tournament[];

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
        <div className="space-y-6">
          {/* Tournament groups */}
          {tournamentGroups.map(({ tournament, games }) => (
            <div key={tournament.id} className="space-y-2">
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
              <div className="space-y-2 ml-4 border-l-2 border-yellow-500/20 pl-4">
                {games.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </div>
          ))}

          {/* Standalone games */}
          {standaloneGames.length > 0 && (
            <div className="space-y-3">
              {hasTournaments && (
                <h2 className="text-sm font-semibold text-muted-foreground px-2 pt-2">
                  {tt("standalone")}
                </h2>
              )}
              {standaloneGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const t = useTranslations("game");

  const date = new Date(game.game_date);
  const dateStr = date.toLocaleDateString("sr-Latn", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("sr-Latn", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`/games/${game.id}`}>
      <Card className="border-border/40 card-hover bg-card cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Date */}
              <div className="text-center min-w-[60px]">
                <p className="text-xs text-muted-foreground">{dateStr}</p>
                <p className="text-xs text-muted-foreground">{timeStr}</p>
              </div>

              {/* Teams & Score */}
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">Propeleri</span>
                {game.result !== "pending" ? (
                  <div className="flex items-center gap-1 px-3 py-1 rounded-md bg-secondary">
                    <span className="text-lg font-black">
                      {game.is_home ? game.home_score : game.away_score}
                    </span>
                    <span className="text-muted-foreground mx-1">:</span>
                    <span className="text-lg font-black">
                      {game.is_home ? game.away_score : game.home_score}
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">{t("vs")}</span>
                )}
                <span className="font-bold text-sm">{game.opponent}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {game.location && (
                <span className="text-xs text-muted-foreground hidden md:flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {game.location}
                </span>
              )}
              <Badge
                className={`text-xs ${RESULT_COLORS[game.result as GameResult]}`}
              >
                {t(`result.${game.result}`)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
