import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Megaphone } from "lucide-react";
import type { TeamEvent } from "@/types/database";
import { formatInBelgrade } from "@/lib/utils/datetime";

function getLocalizedField(
  item: TeamEvent,
  locale: string,
  field: "title" | "description" = "title"
): string {
  const ruField = field === "title" ? item.title_ru : item.description_ru;
  const enField = field === "title" ? item.title_en : item.description_en;
  const baseField = field === "title" ? item.title : item.description;

  if (locale === "ru" && ruField) return ruField;
  if (locale === "en" && enField) return enField;
  return baseField ?? "";
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  game: "bg-primary/20 text-primary",
  training: "bg-blue-500/20 text-blue-400",
  tournament: "bg-yellow-500/20 text-yellow-400",
  social: "bg-purple-500/20 text-purple-400",
};

import { PageHeader } from "@/components/ui/page-header";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("events");

  const supabase = await createClient();

  // Fetch events
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("is_published", true)
    .order("event_date", { ascending: false });

  // Fetch the latest published tournament
  const { data: latestTournament } = await supabase
    .from("tournaments")
    .select("*")
    //.eq("is_published", true) // Assuming tournaments should also be published, or check status
    .order("start_date", { ascending: false })
    .limit(1)
    .single();

  let allEvents = (events ?? []) as TeamEvent[];

  // If we have a tournament, convert it to TeamEvent structure and add it
  if (latestTournament) {
    const tournamentEvent: TeamEvent = {
      id: latestTournament.id,
      title: latestTournament.name,
      title_ru: null,
      title_en: null,
      description: latestTournament.description,
      description_ru: null,
      description_en: null,
      event_type: "tournament",
      event_date: latestTournament.start_date,
      location: latestTournament.location,
      cover_image_url: null,
      tournament_id: latestTournament.id,
      is_published: true,
      created_by: null,
      created_at: latestTournament.created_at,
      updated_at: latestTournament.created_at
    };

    // merging tournament into events list and sorting by date
    allEvents.push(tournamentEvent);
    allEvents.sort((a, b) => {
      const dateA = new Date(a.event_date || 0).getTime();
      const dateB = new Date(b.event_date || 0).getTime();
      return dateB - dateA;
    });
  }


  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title={t("title")} icon={Megaphone} iconClassName="bg-purple-500/10 border-purple-500/20 text-purple-400" />

      {allEvents.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t("noEvents")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allEvents.map((event) => {
            const isTournament = event.event_type === "tournament";
            const href = isTournament ? `/tournaments/${event.id}` : `/events/${event.id}`;

            return (
              <Link key={event.id} href={href} className="block group">
                <Card
                  className={`border-border/40 overflow-hidden transition-all duration-300 hover:shadow-lg ${isTournament
                      ? "bg-gradient-to-br from-yellow-500/5 via-card to-card border-yellow-500/20 hover:border-yellow-500/40"
                      : "bg-card hover:border-primary/20"
                    }`}
                >
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row h-full">
                      {event.cover_image_url ? (
                        <div className="w-full sm:w-48 h-48 sm:h-auto flex-shrink-0 relative overflow-hidden">
                          <Image
                            src={event.cover_image_url}
                            alt={getLocalizedField(event, locale)}
                            width={300}
                            height={200}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          {isTournament && (
                            <div className="absolute inset-0 bg-yellow-500/10 mix-blend-overlay" />
                          )}
                        </div>
                      ) : (
                        <div className={`w-full sm:w-48 h-32 sm:h-auto flex-shrink-0 flex items-center justify-center relative overflow-hidden ${isTournament ? "bg-yellow-500/10" : "bg-muted/30"
                          }`}>
                          {isTournament ? (
                            <>
                              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-transparent opacity-50" />
                              <Award className="h-12 w-12 text-yellow-500 relative z-10 animate-pulse" style={{ animationDuration: '3s' }} />
                            </>
                          ) : (
                            <Megaphone className="h-10 w-10 text-muted-foreground/30" />
                          )}
                        </div>
                      )}

                      <div className="p-5 flex-1 flex flex-col justify-center">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1.5">
                            <Badge
                              variant="outline"
                              className={`text-xs border-0 px-2 py-0.5 ${isTournament
                                  ? "bg-yellow-500/10 text-yellow-500 ring-1 ring-yellow-500/20"
                                  : EVENT_TYPE_COLORS[event.event_type]
                                }`}
                            >
                              {event.event_type}
                            </Badge>

                            <h3 className={`font-bold transition-colors ${isTournament ? "text-xl sm:text-2xl group-hover:text-yellow-500" : "text-lg group-hover:text-primary"
                              }`}>
                              {getLocalizedField(event, locale)}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground pt-1">
                              {event.event_date && (
                                <div className="flex items-center gap-1.5">
                                  <CalendarDays className={`h-4 w-4 ${isTournament ? "text-yellow-500/70" : "text-primary/70"}`} />
                                  <span className={isTournament ? "text-foreground/90 font-medium" : ""}>
                                    {formatInBelgrade(event.event_date, locale === "en" ? "en-US" : "sr-Latn", {
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    })}
                                  </span>
                                </div>
                              )}

                              {event.location && (
                                <div className="flex items-center gap-1.5">
                                  <MapPin className={`h-4 w-4 ${isTournament ? "text-yellow-500/70" : "text-primary/70"}`} />
                                  <span>{event.location}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {event.description && (
                          <p className={`text-sm text-muted-foreground mt-3 line-clamp-2 ${isTournament ? "text-foreground/70" : ""}`}>
                            {getLocalizedField(event, locale, "description")}
                          </p>
                        )}

                        {isTournament && (
                          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-yellow-500 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                            <span>{t("viewTournament" as any) || "View Tournament"}</span>
                            <span aria-hidden="true">→</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  );
}

import { Award } from "lucide-react";

