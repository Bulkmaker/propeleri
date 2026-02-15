import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { GameDetailView } from "@/components/matches/GameDetailView";
import { JsonLd } from "@/components/shared/JsonLd";
import { formatInBelgrade } from "@/lib/utils/datetime";
import type {
  GameLineup,
  GameStats,
  SlotPosition,
  Team,
  Tournament,
  TournamentMatch,
  Profile,
} from "@/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("*, opponent_team:teams!games_opponent_team_id_fkey(name)")
    .eq("slug", slug)
    .single();

  if (!game) return { title: "Game Not Found" };

  const opponent =
    (game.opponent_team as { name: string } | null)?.name ??
    game.opponent ??
    "Unknown";
  const dateStr = formatInBelgrade(
    game.game_date,
    locale === "sr" ? "sr-Latn" : locale,
    { day: "numeric", month: "long", year: "numeric" }
  );
  const teamScore = game.is_home ? game.home_score : game.away_score;
  const oppScore = game.is_home ? game.away_score : game.home_score;
  const score =
    game.result !== "pending" ? `${teamScore}:${oppScore}` : "";

  const title = t("gameDetail.title", { opponent, date: dateStr });
  const description = t("gameDetail.description", {
    opponent,
    score: score || "TBD",
  });
  const path = `/games/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: locale === "sr" ? path : `/${locale}${path}`,
      languages: { sr: path, ru: `/ru${path}`, en: `/en${path}` },
    },
    openGraph: {
      title: `Propeleri vs ${opponent} ${score}`.trim(),
      description,
    },
  };
}

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
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const tc = await getTranslations("common");

  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!game) notFound();

  const gameId = game.id;
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

  const opponentTeam = game.opponent_team_id
    ? teams.find((t) => t.id === game.opponent_team_id)
    : undefined;
  const opponentName = opponentTeam?.name ?? game.opponent ?? "Unknown";

  return (
    <div className="container mx-auto px-4 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: `Propeleri vs ${opponentName}`,
          startDate: game.game_date,
          ...(game.location
            ? { location: { "@type": "Place", name: game.location } }
            : {}),
          homeTeam: {
            "@type": "SportsTeam",
            name: game.is_home ? "HC Propeleri" : opponentName,
          },
          awayTeam: {
            "@type": "SportsTeam",
            name: game.is_home ? opponentName : "HC Propeleri",
          },
        }}
      />
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
      />
    </div>
  );
}
