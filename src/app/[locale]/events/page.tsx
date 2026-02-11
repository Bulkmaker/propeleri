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
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("is_published", true)
    .order("event_date", { ascending: false });

  const allEvents = (events ?? []) as TeamEvent[];

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
          {allEvents.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="border-border/40 card-hover bg-card cursor-pointer overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    {event.cover_image_url && (
                      <div className="w-32 md:w-48 flex-shrink-0">
                        <Image
                          src={event.cover_image_url}
                          alt={getLocalizedField(event, locale)}
                          width={192}
                          height={128}
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
                              {formatInBelgrade(event.event_date, "sr-Latn", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
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
