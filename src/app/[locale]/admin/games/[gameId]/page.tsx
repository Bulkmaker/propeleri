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
import { UnifiedGameEditor } from "@/components/games/UnifiedGameEditor";
import type {
  Game,
  Tournament,
} from "@/types/database";

export default function AdminGameEditPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const router = useRouter();
  const tg = useTranslations("game");

  const [game, setGame] = useState<Game | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [gameRes, tournamentRes] = await Promise.all([
      supabase.from("games").select("*").eq("id", gameId).single(),
      supabase.from("games").select("tournament_id").eq("id", gameId).single()
        .then(async (res) => {
          if (res.data?.tournament_id) {
            return supabase.from("tournaments").select("*").eq("id", res.data.tournament_id).single();
          }
          return { data: null, error: null };
        })
    ]);

    if (gameRes.data) setGame(gameRes.data);
    if (tournamentRes.data) setTournament(tournamentRes.data);
    setLoading(false);
  }, [gameId, supabase]);

  useEffect(() => {
    loadData();
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
        <Link href="/admin/games">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {game.opponent} - {new Date(game.game_date).toLocaleDateString()}
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
