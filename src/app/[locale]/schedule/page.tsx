import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import { TrainingScoreView } from "@/components/training/TrainingScoreView";
import { CalendarDays, Dumbbell } from "lucide-react";
import { RESULT_COLORS } from "@/lib/utils/constants";
import type {
  Game,
  GameResult,

  Team,
  TrainingSession,
  TrainingSessionStatus,
} from "@/types/database";
import { parseTrainingMatchData } from "@/lib/utils/training-match";
import { formatInBelgrade } from "@/lib/utils/datetime";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("schedule.title"),
    description: t("schedule.description"),
    alternates: {
      canonical: locale === "sr" ? "/schedule" : `/${locale}/schedule`,
      languages: { sr: "/schedule", ru: "/ru/schedule", en: "/en/schedule" },
    },
    openGraph: { title: t("schedule.title"), description: t("schedule.description") },
  };
}

type ScheduleItem = {
  id: string;
  type: "game" | "training";
  date: string;
  title: string;
  opponentName?: string;
  opponentLogoUrl?: string | null;
  opponentCountry?: string | null;
  teamScore?: number;
  opponentScore?: number;
  trainingScoreA?: number;
  trainingScoreB?: number;
  subtitle?: string;
  result?: GameResult;
  status?: TrainingSessionStatus;
  location?: string;
  href: string;
};

function normalizeStatus(status: string | null | undefined): TrainingSessionStatus {
  if (status === "completed" || status === "canceled") return status;
  return "planned";
}

function statusBadgeClass(status: TrainingSessionStatus) {
  if (status === "completed") return "bg-green-500/10 text-green-500 border-green-500/20";
  if (status === "canceled") return "bg-red-500/10 text-red-500 border-red-500/20";
  return "bg-blue-500/10 text-blue-500 border-blue-500/20";
}

function getEndOfCurrentWeek(date: Date) {
  const endOfWeek = new Date(date);
  const dayOfWeek = endOfWeek.getDay(); // 0 = Sunday
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
}

import { PageHeader } from "@/components/ui/page-header";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("schedule");
  const tg = await getTranslations("game");
  const ts = await getTranslations("training");

  const supabase = await createClient();

  // Get upcoming games
  const [gamesRes, trainingsRes, teamsRes] = await Promise.all([
    supabase
      .from("games")
      .select("*")
      .order("game_date", { ascending: true }),
    supabase
      .from("training_sessions")
      .select("*")
      .order("session_date", { ascending: true }),
    supabase.from("teams").select("*"),
  ]);

  const games = (gamesRes.data ?? []) as Game[];
  const trainings = (trainingsRes.data ?? []) as TrainingSession[];
  const teams = (teamsRes.data ?? []) as Team[];

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const items: ScheduleItem[] = [
    ...games.map((game) => {
      const opponent = game.opponent_team_id ? teamMap.get(game.opponent_team_id) : undefined;
      const opponentName = opponent?.name ?? game.opponent ?? "Unknown Opponent";

      return {
        id: game.id,
        type: "game" as const,
        date: game.game_date,
        title: `Propeleri vs ${opponentName}`,
        opponentName: opponentName,
        opponentLogoUrl: opponent?.logo_url,
        opponentCountry: opponent?.country,
        teamScore: game.result === "pending" ? undefined : game.is_home ? game.home_score : game.away_score,
        opponentScore: game.result === "pending" ? undefined : game.is_home ? game.away_score : game.home_score,
        subtitle: game.is_home ? tg("home") : tg("away"),
        result: game.result,
        location: game.location ?? undefined,
        href: `/games/${game.id}`,
      };
    }),
    ...trainings.map((session) => {
      const matchData = parseTrainingMatchData(session.match_data);
      return {
        id: session.id,
        type: "training" as const,
        date: session.session_date,
        title: session.title || ts("session"),
        status: normalizeStatus(session.status),
        trainingScoreA: matchData?.team_a_score,
        trainingScoreB: matchData?.team_b_score,
        location: session.location ?? undefined,
        href: `/training/${session.id}`,
      };
    }),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const now = new Date();
  const endOfWeek = getEndOfCurrentWeek(now);
  const filteredItems = items.filter((item) => {
    const itemDate = new Date(item.date);
    if (itemDate < now) return true;
    if (item.type === "training") return itemDate <= endOfWeek;
    return true;
  });

  const upcoming = filteredItems.filter((i) => new Date(i.date) >= now);
  const past = filteredItems.filter((i) => new Date(i.date) < now).reverse();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title={t("title")} icon={CalendarDays} />

      {filteredItems.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t("noEvents")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="h-1 w-6 bg-primary rounded-full" />
                {t("thisMonth")}
              </h2>
              <div className="space-y-10 md:space-y-12">
                {upcoming.map((item) => (
                  <ScheduleCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                <span className="h-1 w-6 bg-muted-foreground/30 rounded-full" />
                {t("pastEvents")}
              </h2>
              <div className="space-y-10 md:space-y-12 opacity-70">
                {past.slice(0, 10).map((item) => (
                  <ScheduleCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScheduleCard({ item }: { item: ScheduleItem }) {
  const tg = useTranslations("game");
  const tt = useTranslations("training");
  const dateLabel = formatInBelgrade(item.date, "sr-Latn", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = formatInBelgrade(item.date, "sr-Latn", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (item.type === "game" && item.result && item.opponentName) {
    return (
      <GameMatchCard
        href={item.href}
        teamName="Propeleri"
        opponentName={item.opponentName}
        opponentLogoUrl={item.opponentLogoUrl}
        opponentCountry={item.opponentCountry}
        teamScore={item.teamScore}
        opponentScore={item.opponentScore}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        location={item.location}
        resultLabel={tg(`result.${item.result}`)}
        resultClassName={RESULT_COLORS[item.result as GameResult]}
        matchTimeLabel={tg("matchTime")}
        variant="poster"
      />
    );
  }

  return (
    <Link href={item.href} className="block max-w-4xl mx-auto my-3 px-1 md:px-2">
      <Card className="border-border/40 card-hover bg-card cursor-pointer py-0">
        <CardContent className="px-4 py-4 md:px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400">
              <Dumbbell className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight flex items-center gap-2">
                {item.title}
                {item.status && (
                  <Badge
                    variant="outline"
                    className={statusBadgeClass(item.status)}
                  >
                    {tt(`status.${item.status}`)}
                  </Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {dateLabel} {timeLabel}
                {item.location && ` — ${item.location}`}
              </p>
            </div>
          </div>
          {item.trainingScoreA != null && item.trainingScoreB != null && (
            <div className="w-full border-t border-border/20 pt-4 sm:border-t-0 sm:pt-0 sm:w-auto flex justify-center">
              <TrainingScoreView
                teamAScore={item.trainingScoreA}
                teamBScore={item.trainingScoreB}
                teamALabel={tt("teamA")}
                teamBLabel={tt("teamB")}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
