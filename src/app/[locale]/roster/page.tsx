import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import type { Profile } from "@/types/database";
import { POSITION_COLORS } from "@/lib/utils/constants";
import type { PlayerPosition } from "@/types/database";

export default async function RosterPage() {
  const t = useTranslations("roster");
  const tp = useTranslations("positions");

  const supabase = await createClient();
  const { data: players } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .eq("is_approved", true)
    .order("jersey_number", { ascending: true });

  const allPlayers = (players ?? []) as Profile[];

  const forwards = allPlayers.filter((p) => p.position === "forward");
  const defense = allPlayers.filter((p) => p.position === "defense");
  const goalies = allPlayers.filter((p) => p.position === "goalie");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {allPlayers.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Nema registrovanih igraca</p>
        </div>
      ) : (
        <div className="space-y-10">
          {forwards.length > 0 && (
            <PositionSection title={tp("forward")} players={forwards} />
          )}
          {defense.length > 0 && (
            <PositionSection title={tp("defense")} players={defense} />
          )}
          {goalies.length > 0 && (
            <PositionSection title={tp("goalie")} players={goalies} />
          )}
        </div>
      )}
    </div>
  );
}

function PositionSection({
  title,
  players,
}: {
  title: string;
  players: Profile[];
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span className="h-1 w-6 bg-primary rounded-full" />
        {title}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
}

function PlayerCard({ player }: { player: Profile }) {
  const tp = useTranslations("positions");
  const tr = useTranslations("roles");
  const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`;

  return (
    <Link href={`/roster/${player.id}`}>
      <Card className="border-border/40 card-hover bg-card group cursor-pointer">
        <CardContent className="p-4 text-center">
          <Avatar className="h-20 w-20 mx-auto mb-3 ring-2 ring-border group-hover:ring-primary/50 transition-all">
            <AvatarImage src={player.avatar_url ?? undefined} />
            <AvatarFallback className="bg-secondary text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {player.jersey_number != null && (
            <p className="text-2xl font-black text-primary mb-1">
              #{player.jersey_number}
            </p>
          )}
          <p className="font-semibold text-sm">
            {player.first_name} {player.last_name}
          </p>
          <Badge
            variant="secondary"
            className={`mt-2 text-xs ${POSITION_COLORS[player.position as PlayerPosition]}`}
          >
            {tp(player.position)}
          </Badge>
          {player.team_role !== "player" && (
            <Badge variant="outline" className="mt-1 text-xs border-primary/30 text-primary">
              {player.team_role === "captain" ? "C" : "A"}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
