import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Dumbbell } from "lucide-react";
import { RESULT_COLORS } from "@/lib/utils/constants";
import type { Game, GameResult, TrainingSession } from "@/types/database";
import Image from "next/image";

type ScheduleItem = {
  id: string;
  type: "game" | "training";
  date: string;
  title: string;
  subtitle?: string;
  result?: GameResult;
  location?: string;
  href: string;
};

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
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .order("game_date", { ascending: true });

  // Get upcoming training sessions
  const { data: trainings } = await supabase
    .from("training_sessions")
    .select("*")
    .order("session_date", { ascending: true });

  const items: ScheduleItem[] = [
    ...((games ?? []) as Game[]).map((g) => ({
      id: g.id,
      type: "game" as const,
      date: g.game_date,
      title: `Propeleri vs ${g.opponent}`,
      subtitle: g.is_home ? tg("home") : tg("away"),
      result: g.result,
      location: g.location,
      href: `/games/${g.id}`,
    })),
    ...((trainings ?? []) as TrainingSession[]).map((session) => ({
      id: session.id,
      type: "training" as const,
      date: session.session_date,
      title: session.title || ts("session"),
      location: session.location ?? undefined,
      href: `/training/${session.id}`,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const now = new Date();
  const upcoming = items.filter((i) => new Date(i.date) >= now);
  const past = items.filter((i) => new Date(i.date) < now).reverse();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {items.length === 0 ? (
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
              <div className="space-y-2.5">
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
              <div className="space-y-2.5 opacity-70">
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
  const date = new Date(item.date);

  return (
    <Link href={item.href} className="block">
      <Card className="border-border/40 card-hover bg-card cursor-pointer">
        <CardContent className="px-4 py-4 md:px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {item.type === "game" ? (
              <div className="h-14 w-14 rounded-xl flex items-center justify-center bg-primary/10">
                <Image src="/logo.svg" alt="HC Propeleri" width={40} height={40} />
              </div>
            ) : (
              <div className="h-14 w-14 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400">
                <Dumbbell className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="font-bold text-lg leading-tight">{item.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {date.toLocaleDateString("sr-Latn", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                {date.toLocaleTimeString("sr-Latn", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {item.location && ` — ${item.location}`}
              </p>
            </div>
          </div>
          {item.result && (
            <Badge className={`text-sm px-2.5 py-1 ${RESULT_COLORS[item.result as GameResult]}`}>
              {tg(`result.${item.result}`)}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
