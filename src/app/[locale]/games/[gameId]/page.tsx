import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameDetailView } from "@/components/matches/GameDetailView";
import type {
  GameLineup,
  GameStats,
  SlotPosition,
  Team,
  Tournament,
  TournamentMatch,
  Profile,
} from "@/types/database";

type GameLineupEntry = Omit<GameLineup, "line_number" | "slot_position" | "player"> & {
  line_number: number | null;
  slot_position: SlotPosition | null;
  player: Profile | null;
};

type GameStatEntry = Omit<GameStats, "player"> & {
  player: Profile | null;
};

// Types are now in GameDetailView component

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ locale: string; gameId: string }>;
}) {
  const { locale, gameId } = await params;
  setRequestLocale(locale);

  const tc = await getTranslations("common");

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (!game) notFound();

  const [lineupRes, statsRes, teamsRes, tournamentsRes, tournamentMatchRes] = await Promise.all([
    supabase
      .from("game_lineups")
      .select("*, player:profiles(*)")
      .eq("game_id", gameId),
    supabase
      .from("game_stats")
      .select("*, player:profiles(*)")
      .eq("game_id", gameId)
      .order("goals", { ascending: false }),
    supabase.from("teams").select("*"),
    supabase.from("tournaments").select("*"),
    supabase.from("tournament_matches").select("*").eq("game_id", gameId).maybeSingle()
  ]);

  const lineup = (lineupRes.data ?? []) as GameLineupEntry[];
  const stats = (statsRes.data ?? []) as GameStatEntry[];
  const teams = (teamsRes.data ?? []) as Team[];
  const tournaments = (tournamentsRes.data ?? []) as Tournament[];
  const tournamentMatch = (tournamentMatchRes.data ?? null) as TournamentMatch | null;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/games"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      <GameDetailView
        game={game}
        lineup={lineup}
        stats={stats}
        teams={teams}
        tournaments={tournaments}
        tournamentMatch={tournamentMatch}
        locale={locale}
        isAdmin={false}
      />
    </div>
  );
}
