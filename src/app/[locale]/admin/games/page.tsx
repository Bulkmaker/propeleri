"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { Plus, Trophy, Loader2 } from "lucide-react";
import type { Game, Season, GameResult, Tournament, Team, Profile } from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";
import { formatInBelgrade } from "@/lib/utils/datetime";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import { Badge } from "@/components/ui/badge";
import { GameForm } from "@/components/admin/games/GameForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LoadingErrorEmpty } from "@/components/shared/LoadingErrorEmpty";

export default function AdminGamesPage() {
  const t = useTranslations("admin");
  const tg = useTranslations("game");
  const tt = useTranslations("tournament");
  const tc = useTranslations("common");

  const [games, setGames] = useState<Game[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        gamesRes,
        seasonsRes,
        tournamentsRes,
        teamsRes,
        playersRes,
      ] = await Promise.all([
        supabase.from("games").select("*").order("game_date", { ascending: false }),
        supabase.from("seasons").select("*").order("start_date", { ascending: false }),
        supabase.from("tournaments").select("*").order("start_date", { ascending: false }),
        supabase.from("teams").select("*"),
        supabase.from("profiles").select("*").eq("is_active", true).eq("is_approved", true).order("jersey_number", { ascending: true }),
      ]);

      if (gamesRes.error) throw gamesRes.error;
      if (seasonsRes.error) throw seasonsRes.error;
      if (tournamentsRes.error) throw tournamentsRes.error;
      if (teamsRes.error) throw teamsRes.error;
      if (playersRes.error) throw playersRes.error;

      setGames((gamesRes.data ?? []) as Game[]);
      setSeasons((seasonsRes.data ?? []) as Season[]);
      setTournaments((tournamentsRes.data ?? []) as Tournament[]);
      setTeams((teamsRes.data ?? []) as Team[]);
      setPlayers((playersRes.data ?? []) as Profile[]);
    } catch (err: unknown) {
      console.error("Error loading admin data:", err);
      setError(err instanceof Error ? err.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }, [supabase, tc]);

  useEffect(() => {
    loadData();
  }, [loadData]);



  async function handleCreateSave(payload: Record<string, unknown>) {
    const { error: insertError } = await supabase.from("games").insert(payload);
    if (insertError) {
      throw insertError;
    }
    setDialogOpen(false);
    await loadData();
  }

  // Delete is now handled inside the edit page or we can keep it here but user asked to remove buttons.
  // We'll remove the delete button from the list view as requested ("Make card clickable.. remove Edit/Stats/Lineup buttons").
  // If deletion is needed, it can be done inside the detail page.

  return (
    <div>
      <AdminPageHeader title={t("manageGames")}>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary">
              <Plus className="h-4 w-4 mr-2" />
              {tc("create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {tc("create")} - {tc("games")}
              </DialogTitle>
            </DialogHeader>
            <GameForm
              seasons={seasons}
              tournaments={tournaments}
              teams={teams}
              players={players}
              onSave={handleCreateSave}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </AdminPageHeader>

      <div className="p-6 space-y-3">
        <LoadingErrorEmpty loading={loading} error={error} isEmpty={games.length === 0} onRetry={loadData}>
          {games.map((game) => {
            const opponentTeam = teams.find((t) => t.id === game.opponent_team_id);
            const opponentName = opponentTeam?.name ?? game.opponent ?? tg("unknownOpponent");
            const teamScore = game.is_home ? game.home_score : game.away_score;
            const opponentScore = game.is_home ? game.away_score : game.home_score;
            const tournament = tournaments.find((t) => t.id === game.tournament_id);

            // Always navigate to unified game page
            const href = `/admin/games/${game.id}`;

            return (
              <Link key={game.id} href={href} className="block transition-transform hover:scale-[1.01]">
                <GameMatchCard
                  teamName="Propeleri"
                  opponentName={opponentName}
                  opponentLogoUrl={opponentTeam?.logo_url || null}
                  opponentCountry={opponentTeam?.country || null}
                  teamScore={game.result === "pending" ? undefined : teamScore}
                  opponentScore={game.result === "pending" ? undefined : opponentScore}
                  dateLabel={formatInBelgrade(game.game_date, "sr-Latn", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  timeLabel={formatInBelgrade(game.game_date, "sr-Latn", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  location={game.location}
                  resultLabel={tg(`result.${game.result}`)}
                  resultClassName={RESULT_COLORS[game.result as GameResult]}
                  variant="compact"
                  badges={
                    <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                      {tournament && (
                        <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20 flex items-center gap-1">
                          <Trophy className="h-3 w-3" />
                          {tournament.name}
                        </Badge>
                      )}
                      {game.auto_generated_from_tournament && (
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
                          {tt("managedByTournament")}
                        </Badge>
                      )}
                    </div>
                  }
                // actions prop removed to clean up the card
                />
              </Link>
            );
          })}
        </LoadingErrorEmpty>
      </div>
    </div>
  );
}
