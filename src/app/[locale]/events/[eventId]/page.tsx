import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, CalendarDays, MapPin, ArrowRight } from "lucide-react";
import type { TeamEvent, Tournament, TournamentFormat } from "@/types/database";
import { formatInBelgrade } from "@/lib/utils/datetime";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; eventId: string }>;
}): Promise<Metadata> {
  const { locale, eventId } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, title_ru, title_en, description, description_ru, description_en, cover_image_url")
    .eq("id", eventId)
    .single();

  if (!event) return { title: "Event Not Found" };

  const name =
    locale === "ru" && event.title_ru
      ? event.title_ru
      : locale === "en" && event.title_en
        ? event.title_en
        : event.title;
  const desc =
    locale === "ru" && event.description_ru
      ? event.description_ru
      : locale === "en" && event.description_en
        ? event.description_en
        : event.description;

  const title = t("eventDetail.title", { name });
  const description = desc || t("eventDetail.description", { name });
  const path = `/events/${eventId}`;

  return {
    title,
    description,
    alternates: {
      canonical: locale === "sr" ? path : `/${locale}${path}`,
      languages: { sr: path, ru: `/ru${path}`, en: `/en${path}` },
    },
    openGraph: {
      title,
      description,
      ...(event.cover_image_url
        ? { images: [{ url: event.cover_image_url }] }
        : {}),
    },
  };
}

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  cup: "formatCup",
  placement: "formatPlacement",
  round_robin: "formatRoundRobin",
  custom: "formatCustom",
};

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
  const te = await getTranslations("events");
  const tt = await getTranslations("tournament");

  const supabase = await createClient();
  const { data: eventRaw } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();
  const event = eventRaw as TeamEvent | null;

  if (!event) notFound();

  let tournament: Tournament | null = null;
  if (event.tournament_id) {
    const { data: tournamentRaw } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", event.tournament_id)
      .maybeSingle();
    tournament = (tournamentRaw as Tournament | null) ?? null;
  }

  const eventTitle = getLocalizedField(event, locale) || tournament?.name || "";
  const eventDescription =
    getLocalizedField(event, locale, "description") ||
    tournament?.description ||
    "";
  const eventDate = event.event_date || tournament?.start_date || null;
  const eventLocation = event.location || tournament?.location || null;
  const dateLocale =
    locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "sr-Latn";

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
            alt={eventTitle}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      <Badge className="mb-3">{event.event_type}</Badge>

      <h1 className="text-3xl font-bold mb-4">
        {eventTitle}
      </h1>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
        {eventDate && (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            {formatInBelgrade(eventDate, dateLocale, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        )}
        {eventLocation && (
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {eventLocation}
          </span>
        )}
      </div>

      {eventDescription && (
        <div className="prose prose-invert max-w-none">
          <p className="whitespace-pre-wrap text-muted-foreground">
            {eventDescription}
          </p>
        </div>
      )}

      {tournament && (
        <Card className="border-border/40 mt-8">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {te("linkedTournament")}
                </p>
                <h2 className="text-xl font-semibold mt-1">{tournament.name}</h2>
              </div>
              <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                {tt(FORMAT_LABELS[tournament.format as TournamentFormat] ?? "formatCustom")}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                {tournament.start_date} — {tournament.end_date}
              </span>
              {tournament.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {tournament.location}
                </span>
              )}
            </div>

            {tournament.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {tournament.description}
              </p>
            )}

            <Button asChild className="w-full sm:w-auto">
              <Link href={`/tournaments/${tournament.id}`}>
                {te("openTournament")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
