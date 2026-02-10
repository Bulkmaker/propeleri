import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, CalendarDays, MapPin } from "lucide-react";

function getLocalizedField(
  item: Record<string, any>,
  locale: string,
  field: string = "title"
): string {
  if (locale === "ru" && item[`${field}_ru`]) return item[`${field}_ru`];
  if (locale === "en" && item[`${field}_en`]) return item[`${field}_en`];
  return item[field];
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const tc = useTranslations("common");
  const locale = await getLocale();

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

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
        <div className="rounded-xl overflow-hidden mb-6 aspect-[16/9]">
          <img
            src={event.cover_image_url}
            alt={getLocalizedField(event, locale)}
            className="w-full h-full object-cover"
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
