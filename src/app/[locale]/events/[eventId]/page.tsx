import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, CalendarDays, MapPin } from "lucide-react";
import type { TeamEvent } from "@/types/database";

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

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; eventId: string }>;
}) {
  const { locale, eventId } = await params;
  setRequestLocale(locale);

  const tc = await getTranslations("common");

  const supabase = await createClient();
  const { data: eventRaw } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();
  const event = eventRaw as TeamEvent | null;

  if (!event) notFound();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link
        href="/events"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      {event.cover_image_url && (
        <div className="rounded-xl overflow-hidden mb-6 aspect-[16/9] relative">
          <Image
            src={event.cover_image_url}
            alt={getLocalizedField(event, locale)}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      <Badge className="mb-3">{event.event_type}</Badge>

      <h1 className="text-3xl font-bold mb-4">
        {getLocalizedField(event, locale)}
      </h1>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
        {event.event_date && (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            {new Date(event.event_date).toLocaleDateString("sr-Latn", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        )}
        {event.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {event.location}
          </span>
        )}
      </div>

      {event.description && (
        <div className="prose prose-invert max-w-none">
          <p className="whitespace-pre-wrap text-muted-foreground">
            {getLocalizedField(event, locale, "description")}
          </p>
        </div>
      )}
    </div>
  );
}
