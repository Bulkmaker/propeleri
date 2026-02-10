import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, CalendarDays, MapPin, CheckCircle, XCircle } from "lucide-react";

export default async function TrainingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const { locale, sessionId } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("training");
  const ts = await getTranslations("stats");
  const tc = await getTranslations("common");

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) notFound();

  const { data: stats } = await supabase
    .from("training_stats")
    .select("*, player:profiles(*)")
    .eq("session_id", sessionId)
    .order("goals", { ascending: false });

  const date = new Date(session.session_date);

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/training"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      {/* Session Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {session.title || t("session")}
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            {date.toLocaleDateString("sr-Latn", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {session.location}
            </span>
          )}
        </div>
      </div>

      {/* Stats Table */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle>{t("attendance")} & {ts("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats && stats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-center">{t("attendance")}</TableHead>
                  <TableHead className="text-center">{ts("goals")}</TableHead>
                  <TableHead className="text-center">{ts("assists")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-primary font-bold">
                      {s.player?.jersey_number ?? "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {s.player?.first_name} {s.player?.last_name}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.attended ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">{s.goals}</TableCell>
                    <TableCell className="text-center">{s.assists}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-6">
              {tc("noData")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
