import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrainingScoreView } from "@/components/training/TrainingScoreView";
import { TrainingFilters } from "@/components/training/TrainingFilters";
import { CalendarDays, ChevronRight, MapPin, Users, Video } from "lucide-react";
import { AdminEditButton } from "@/components/shared/AdminEditButton";
import type { TrainingSession, TrainingSessionStatus, Season } from "@/types/database";
import { parseTrainingMatchData } from "@/lib/utils/training-match";
import { formatInBelgrade } from "@/lib/utils/datetime";

export const revalidate = 60;

function normalizeStatus(status: string | null | undefined): TrainingSessionStatus {
  if (status === "completed" || status === "canceled") return status;
  return "planned";
}

function statusBadgeClass(status: TrainingSessionStatus) {
  if (status === "completed") return "bg-green-500/10 text-green-500 border-green-500/20";
  if (status === "canceled") return "bg-red-500/10 text-red-500 border-red-500/20";
  return "bg-blue-500/10 text-blue-500 border-blue-500/20";
}

export default async function TrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("training");
  const tc = await getTranslations("common");
  const ts = await getTranslations("schedule");

  const supabase = await createClient();

  const { data: seasonsData } = await supabase
    .from("seasons")
    .select("*")
    .order("start_date", { ascending: false });

  const seasons = (seasonsData ?? []) as Season[];
  const currentSeason = seasons.find((s) => s.is_current) ?? seasons[0];

  const selectedSeasonId =
    (typeof query.season === "string" && seasons.some((s) => s.id === query.season)
      ? query.season
      : null) ?? currentSeason?.id;

  const videoFilter = query.video === "1";

  if (!selectedSeasonId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{tc("noData")}</p>
        </div>
      </div>
    );
  }

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("season_id", selectedSeasonId)
    .order("session_date", { ascending: false });

  const allSessions = (sessions ?? []) as TrainingSession[];
  const now = new Date();

  const sessionsWithMatch = allSessions
    .map((session) => ({
      session,
      date: new Date(session.session_date),
      matchData: parseTrainingMatchData(session.match_data),
      hasVideo: Boolean(session.youtube_url),
    }))
    .filter((item) => !videoFilter || item.hasVideo);

  const upcomingSessions = sessionsWithMatch
    .filter(({ date }) => date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const pastSessions = sessionsWithMatch
    .filter(({ date }) => date < now)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Users className="h-5 w-5 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
        </div>
        <TrainingFilters
          seasons={seasons.map((s) => ({ id: s.id, name: s.name }))}
          currentSeasonId={selectedSeasonId}
          videoFilter={videoFilter}
          videoLabel={t("hasVideo")}
        />
      </div>

      {sessionsWithMatch.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{tc("noData")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcomingSessions.length > 0 && (
            <>
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="h-1 w-6 bg-primary rounded-full" />
                  {t("nextSession")}
                </h2>
                <SessionCard
                  session={upcomingSessions[0].session}
                  matchData={upcomingSessions[0].matchData}
                  hasVideo={upcomingSessions[0].hasVideo}
                  t={t}
                />
              </div>

              {upcomingSessions.length > 1 && (
                <details className="group">
                  <summary className="text-lg font-semibold mb-4 flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                    <span className="h-1 w-6 bg-primary rounded-full" />
                    {t("otherUpcoming", { count: upcomingSessions.length - 1 })}
                  </summary>
                  <div className="space-y-4 md:space-y-5">
                    {upcomingSessions.slice(1).map(({ session, matchData, hasVideo }) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        matchData={matchData}
                        hasVideo={hasVideo}
                        t={t}
                      />
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          {pastSessions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                <span className="h-1 w-6 bg-muted-foreground/30 rounded-full" />
                {t("pastSessions", { count: pastSessions.length })}
              </h2>
              <div className="space-y-4 md:space-y-5">
                {pastSessions.map(({ session, matchData, hasVideo }) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    matchData={matchData}
                    hasVideo={hasVideo}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  matchData,
  hasVideo,
  t,
}: {
  session: TrainingSession;
  matchData: ReturnType<typeof parseTrainingMatchData>;
  hasVideo: boolean;
  t: Awaited<ReturnType<typeof getTranslations<"training">>>;
}) {
  return (
    <div className="relative">
      <Link href={`/training/${session.id}`} className="block">
        <Card className="border-border/40 card-hover bg-card cursor-pointer rounded-xl overflow-hidden">
          <CardContent className="px-4 py-4 md:px-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                  {session.title || t("session")}
                  <Badge
                    variant="outline"
                    className={statusBadgeClass(normalizeStatus(session.status))}
                  >
                    {t(`status.${normalizeStatus(session.status)}`)}
                  </Badge>
                  {hasVideo && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                      <Video className="h-3 w-3" />
                      Video
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatInBelgrade(session.session_date, "sr-Latn", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                {session.location && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {session.location}
                  </p>
                )}
                {session.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {session.notes}
                  </p>
                )}
              </div>
              {matchData && (
                <TrainingScoreView
                  teamAScore={matchData.team_a_score}
                  teamBScore={matchData.team_b_score}
                  teamALabel={t("teamA")}
                  teamBLabel={t("teamB")}
                  className="shrink-0 hidden sm:block"
                />
              )}
            </div>
            {matchData && (
              <div className="mt-3 sm:hidden">
                <TrainingScoreView
                  teamAScore={matchData.team_a_score}
                  teamBScore={matchData.team_b_score}
                  teamALabel={t("teamA")}
                  teamBLabel={t("teamB")}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
      <AdminEditButton
        href={`/admin/training/${session.id}`}
        className="absolute top-2 right-2 z-10"
      />
    </div>
  );
}
