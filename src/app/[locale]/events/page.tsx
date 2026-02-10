import { useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Megaphone } from "lucide-react";
import type { TeamEvent } from "@/types/database";

function getLocalizedField(
  item: Record<string, any>,
  locale: string,
  field: string = "title"
): string {
  if (locale === "ru" && item[`${field}_ru`]) return item[`${field}_ru`];
  if (locale === "en" && item[`${field}_en`]) return item[`${field}_en`];
  return item[field];
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  game: "bg-primary/20 text-primary",
  training: "bg-blue-500/20 text-blue-400",
  tournament: "bg-yellow-500/20 text-yellow-400",
  social: "bg-purple-500/20 text-purple-400",
};

export default async function EventsPage() {
  const t = useTranslations("events");
  const tc = useTranslations("common");
  const locale = await getLocale();

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("is_published", true)
    .order("event_date", { ascending: false });

  const allEvents = (events ?? []) as TeamEvent[];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Megaphone className="h-5 w-5 text-purple-400" />
        </div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {allEvents.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t("noEvents")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allEvents.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="border-border/40 card-hover bg-card cursor-pointer overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    {event.cover_image_url && (
                      <div className="w-32 md:w-48 flex-shrink-0">
                        <img
                          src={event.cover_image_url}
                          alt={getLocalizedField(event, locale)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge
                            className={`text-xs mb-2 ${EVENT_TYPE_COLORS[event.event_type]}`}
                          >
                            {event.event_type}
                          </Badge>
                          <h3 className="font-semibold">
                            {getLocalizedField(event, locale)}
                          </h3>
                          {event.event_date && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(event.event_date).toLocaleDateString(
                                "sr-Latn",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                }
                              )}
                            </p>
                          )}
                          {event.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </p>
                          )}
                        </div>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {getLocalizedField(event, locale, "description")}
                        </p>
                      )}
                    </div>
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
