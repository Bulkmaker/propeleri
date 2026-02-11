import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { POSITION_COLORS } from "@/lib/utils/constants";
import type { PlayerPosition, Profile, TrainingStats } from "@/types/database";

type TrainingStatWithPlayer = TrainingStats & {
  player: Profile | null;
};

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
  const tp = await getTranslations("positions");

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("training_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) notFound();

  const { data: statsRaw } = await supabase
    .from("training_stats")
    .select("*, player:profiles(*)")
    .eq("session_id", sessionId)
    .order("goals", { ascending: false });
  const stats = (statsRaw ?? []) as TrainingStatWithPlayer[];

  const date = new Date(session.session_date);

  const hasTeams = stats.some((s) => s.training_team);
  const teamA = stats.filter((s) => s.training_team === "team_a");
  const teamB = stats.filter((s) => s.training_team === "team_b");
  const noTeam = stats.filter((s) => !s.training_team);

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

      {/* Teams Display */}
      {hasTeams && (teamA.length > 0 || teamB.length > 0) ? (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Team A - White */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-white border border-border" />
                  {t("teamA")}
                  <Badge variant="outline" className="ml-auto">{teamA.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teamA.map((s) => (
                    <TeamPlayerCard key={s.id} stat={s} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Team B - Dark */}
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-gray-600" />
                  {t("teamB")}
                  <Badge variant="outline" className="ml-auto">{teamB.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teamB.map((s) => (
                    <TeamPlayerCard key={s.id} stat={s} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* No team assigned */}
          {noTeam.length > 0 && (
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t("noTeam")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-2">
                  {noTeam.map((s) => (
                    <TeamPlayerCard key={s.id} stat={s} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Fallback: single table */
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>{t("attendance")} & {ts("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.length > 0 ? (
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
                  {stats.map((s) => (
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
      )}
    </div>
  );
}

function TeamPlayerCard({ stat }: { stat: TrainingStatWithPlayer }) {
  const player = stat.player;
  if (!player) return null;
  const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-secondary/30">
      <Avatar className="h-8 w-8">
        <AvatarImage src={player.avatar_url ?? undefined} />
        <AvatarFallback className="bg-secondary text-xs font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {player.jersey_number != null && (
            <span className="text-primary mr-1">#{player.jersey_number}</span>
          )}
          {player.first_name} {player.last_name}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {stat.attended ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-500" />
        )}
        {stat.goals > 0 && <span className="text-primary font-bold">{stat.goals}G</span>}
        {stat.assists > 0 && <span>{stat.assists}A</span>}
      </div>
      <Badge className={`text-[10px] ${POSITION_COLORS[player.position as PlayerPosition]}`}>
        {player.position === "forward" ? "FW" : player.position === "defense" ? "DF" : "GK"}
      </Badge>
    </div>
  );
}
