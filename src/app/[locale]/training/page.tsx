import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrainingScoreView } from "@/components/training/TrainingScoreView";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { TrainingSession, TrainingSessionStatus } from "@/types/database";
import { parseTrainingMatchData } from "@/lib/utils/training-match";
import { formatInBelgrade } from "@/lib/utils/datetime";

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

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("training");
  const tc = await getTranslations("common");
  const ts = await getTranslations("schedule");

  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("*")
    .order("session_date", { ascending: false });

  const allSessions = (sessions ?? []) as TrainingSession[];
  const now = new Date();
  const endOfWeek = getEndOfCurrentWeek(now);

  const sessionsWithMatch = allSessions
    .map((session) => ({
      session,
      date: new Date(session.session_date),
      matchData: parseTrainingMatchData(session.match_data),
    }))
    .filter(({ date }) => date < now || date <= endOfWeek);

  const upcomingSessions = sessionsWithMatch
    .filter(({ date }) => date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const pastSessions = sessionsWithMatch
    .filter(({ date }) => date < now)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {sessionsWithMatch.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{tc("noData")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {upcomingSessions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="h-1 w-6 bg-primary rounded-full" />
                {ts("thisWeek")}
              </h2>
              <div className="space-y-4 md:space-y-5">
                {upcomingSessions.map(({ session, matchData }) => (
                  <Link key={session.id} href={`/training/${session.id}`} className="block">
                    <Card className="border-border/40 card-hover bg-card cursor-pointer rounded-xl overflow-hidden">
                      <CardContent className="px-4 py-4 md:px-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <CalendarDays className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm flex items-center gap-2">
                                {session.title || t("session")}
                                <Badge
                                  variant="outline"
                                  className={statusBadgeClass(normalizeStatus(session.status))}
                                >
                                  {t(`status.${normalizeStatus(session.status)}`)}
                                </Badge>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatInBelgrade(session.session_date, "sr-Latn", {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </p>
                              {session.notes && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-xl truncate">
                                  {session.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {matchData && (
                              <TrainingScoreView
                                teamAScore={matchData.team_a_score}
                                teamBScore={matchData.team_b_score}
                                teamALabel={t("teamA")}
                                teamBLabel={t("teamB")}
                              />
                            )}
                            {session.location && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {session.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {pastSessions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                <span className="h-1 w-6 bg-muted-foreground/30 rounded-full" />
                {ts("pastEvents")}
              </h2>
              <div className="space-y-4 md:space-y-5">
                {pastSessions.map(({ session, matchData }) => (
                  <Link key={session.id} href={`/training/${session.id}`} className="block">
                    <Card className="border-border/40 card-hover bg-card cursor-pointer rounded-xl overflow-hidden">
                      <CardContent className="px-4 py-4 md:px-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <CalendarDays className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm flex items-center gap-2">
                                {session.title || t("session")}
                                <Badge
                                  variant="outline"
                                  className={statusBadgeClass(normalizeStatus(session.status))}
                                >
                                  {t(`status.${normalizeStatus(session.status)}`)}
                                </Badge>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatInBelgrade(session.session_date, "sr-Latn", {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </p>
                              {session.notes && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-xl truncate">
                                  {session.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {matchData && (
                              <TrainingScoreView
                                teamAScore={matchData.team_a_score}
                                teamBScore={matchData.team_b_score}
                                teamALabel={t("teamA")}
                                teamBLabel={t("teamB")}
                              />
                            )}
                            {session.location && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {session.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
