"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameForm } from "@/components/admin/games/GameForm";
import { GameLineupEditor } from "@/components/games/GameLineupEditor";
import GameStatsEditor from "@/components/games/GameStatsEditor";
import type { Game, Season, Tournament, Opponent, Team, Profile } from "@/types/database";

export default function AdminGameEditPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const router = useRouter();
  const t = useTranslations("common");
  const tg = useTranslations("game");

  const [game, setGame] = useState<Game | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [
        gameRes,
        seasonsRes,
        tournamentsRes,
        opponentsRes,
        teamsRes,
        playersRes
      ] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("seasons").select("*").order("start_date", { ascending: false }),
        supabase.from("tournaments").select("*").order("start_date", { ascending: false }),
        supabase.from("opponents").select("*").order("name"),
        supabase.from("teams").select("*").order("name"),
        supabase.from("profiles").select("*").order("last_name"),
      ]);

      if (gameRes.data) setGame(gameRes.data);
      if (seasonsRes.data) setSeasons(seasonsRes.data);
      if (tournamentsRes.data) setTournaments(tournamentsRes.data);
      if (opponentsRes.data) setOpponents(opponentsRes.data);
      if (teamsRes.data) setTeams(teamsRes.data);
      if (playersRes.data) setPlayers(playersRes.data); // Fixed type mismatch by casting if needed, but Profile[] matches

      setLoading(false);
    }
    loadData();
  }, [gameId, supabase]);

  const handleUpdate = async (updatedData: Partial<Game>) => {
    if (!game) return;

    // Optimistic update
    setGame({ ...game, ...updatedData } as Game);

    const { error } = await supabase
      .from("games")
      .update(updatedData)
      .eq("id", gameId);

    if (error) {
      console.error("Error updating game:", error);
      // Revert or show error could go here
    } else {
      // Ideally re-fetch or just rely on optimistic
      router.refresh();
    }
  };

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
          <h1 className="text-2xl font-bold">
            {game.opponent} - {new Date(game.game_date).toLocaleDateString()}
          </h1>
          <p className="text-muted-foreground text-sm">
            {game.is_home ? "Home" : "Away"} • {game.result}
          </p>
        </div>
        <Button variant="destructive" size="icon" onClick={handleDelete}>
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="details">{tg("details")}</TabsTrigger>
          <TabsTrigger value="lineup">{tg("lineup")}</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <div className="max-w-3xl">
            <GameForm
              initialData={game}
              seasons={seasons}
              tournaments={tournaments}
              opponents={opponents}
              teams={teams}
              players={players}
              onSave={handleUpdate}
            />
          </div>
        </TabsContent>

        <TabsContent value="lineup" className="mt-6">
          <GameLineupEditor gameId={gameId} />
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          <GameStatsEditor gameId={gameId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
