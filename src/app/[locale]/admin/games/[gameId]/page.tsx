"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Loader2, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";

const UnifiedGameEditor = dynamic(
  () => import("@/components/games/UnifiedGameEditor").then((m) => m.UnifiedGameEditor),
  { loading: () => <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> }
);
import type {
  Game,
  Team,
  Tournament,
} from "@/types/database";

export default function AdminGameEditPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const router = useRouter();
  const tg = useTranslations("game");

  const [game, setGame] = useState<Game | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const gameRes = await supabase.from("games").select("*").eq("id", gameId).single();
    const loadedGame = gameRes.data as Game | null;

    if (loadedGame) {
      setGame(loadedGame);

      const [tournamentRes, teamRes] = await Promise.all([
        loadedGame.tournament_id
          ? supabase.from("tournaments").select("*").eq("id", loadedGame.tournament_id).single()
          : Promise.resolve({ data: null }),
        loadedGame.opponent_team_id
          ? supabase.from("teams").select("*").eq("id", loadedGame.opponent_team_id).single()
          : Promise.resolve({ data: null }),
      ]);

      if (tournamentRes.data) setTournament(tournamentRes.data as Tournament);
      if (teamRes.data) setOpponentTeam(teamRes.data as Team);
    }

    setLoading(false);
  }, [gameId, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleDelete = async () => {
    if (!window.confirm(tg("deleteGameConfirm"))) return;

    const { error } = await supabase.from("games").delete().eq("id", gameId);

    if (error) {
      console.error("Error deleting game:", error);
      alert("Error deleting game");
    } else {
      router.push("/admin/games");
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!game) {
    return <div className="p-8">Game not found</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={tournament ? `/admin/tournaments/${tournament.id}` : "/admin/games"}>
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {opponentTeam?.name ?? game.opponent} - {new Date(game.game_date).toLocaleDateString()}
            </h1>
            {tournament && (
              <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-600 bg-yellow-500/10">
                <Trophy className="h-3 w-3 mr-1" />
                {tournament.name}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {game.is_home ? "Home" : "Away"} • {game.result}
            {tournament && ` • ${tournament.name}`}
          </p>
        </div>
        <Button variant="destructive" size="icon" onClick={handleDelete}>
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      <UnifiedGameEditor gameId={gameId} onRefresh={loadData} />
    </div>
  );
}
