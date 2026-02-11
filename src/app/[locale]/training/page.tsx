import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { TrainingSession, TrainingSessionStatus } from "@/types/database";

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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("training");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("*")
    .order("session_date", { ascending: false });

  const allSessions = (sessions ?? []) as TrainingSession[];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {allSessions.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{tc("noData")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allSessions.map((session) => (
            <Link key={session.id} href={`/training/${session.id}`}>
              <Card className="border-border/40 card-hover bg-card cursor-pointer">
                <CardContent className="p-4">
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
                          {new Date(session.session_date).toLocaleDateString(
                            "sr-Latn",
                            {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }
                          )}
                        </p>
                        {session.notes && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-xl truncate">
                            {session.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    {session.location && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {session.location}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
