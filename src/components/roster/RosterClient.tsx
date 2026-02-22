"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";
import { formatPlayerName } from "@/lib/utils/player-name";
import { LayoutGrid, List } from "lucide-react";
import { PlayerEditButton } from "@/components/players/PlayerEditButton";
import { PlayerTable } from "./PlayerTable";

type ViewMode = "grid" | "table";

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export default function RosterClient({ players }: { players: Profile[] }) {
  const t = useTranslations("roster");
  const tp = useTranslations("positions");
  const tc = useTranslations("common");

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = useMemo(
    () => normalizeSearchValue(deferredSearchQuery),
    [deferredSearchQuery]
  );

  const filteredPlayers = useMemo(() => {
    if (!normalizedSearchQuery) return players;

    return players.filter((player) => {
      const searchableParts = [
        player.first_name,
        player.last_name,
        `${player.first_name} ${player.last_name}`,
        `${player.last_name} ${player.first_name}`,
        player.nickname ?? "",
        player.jersey_number?.toString() ?? "",
      ];

      return searchableParts.some((part) =>
        normalizeSearchValue(part).includes(normalizedSearchQuery)
      );
    });
  }, [players, normalizedSearchQuery]);

  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
    );
  }, [filteredPlayers]);

  const coaches = sortedPlayers.filter((player) => player.team_role === "coach");
  const nonCoachPlayers = sortedPlayers.filter((player) => player.team_role !== "coach");
  const forwards = nonCoachPlayers.filter((player) => player.position === "forward");
  const defense = nonCoachPlayers.filter((player) => player.position === "defense");
  const goalies = nonCoachPlayers.filter((player) => player.position === "goalie");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 w-full lg:max-w-xs">
          <Label htmlFor="roster-search">{tc("search")}</Label>
          <Input
            id="roster-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlayersPlaceholder")}
            className="bg-background"
          />
        </div>

        <div className="flex items-end">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-8 w-8 px-0", viewMode === "grid" && "bg-background shadow-sm")}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="sr-only">Grid View</span>
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-8 w-8 px-0", viewMode === "table" && "bg-background shadow-sm")}
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
              <span className="sr-only">Table View</span>
            </Button>
          </div>
        </div>
      </div>

      {sortedPlayers.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p>{tc("noData")}</p>
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
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
              {coaches.length > 0 && (
                <PositionSection title={t("coachesSection")} players={coaches} />
              )}
            </div>
          ) : (
            <PlayerTable players={sortedPlayers} />
          )}
        </>
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
  const tr = useTranslations("roles");
  const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`;

  return (
    <div className="relative h-full">
      <Link href={`/roster/${player.slug}`}>
        <Card className="border-border/40 card-hover bg-card group cursor-pointer h-full">
          <CardContent className="p-4 text-center">
            <Avatar className="h-20 w-20 mx-auto mb-3 ring-2 ring-border group-hover:ring-primary/50 transition-all">
              <AvatarImage src={player.avatar_url ?? undefined} alt={`${player.first_name} ${player.last_name}`} />
              <AvatarFallback className="bg-secondary text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="text-2xl font-black text-primary mb-1 min-h-8 leading-8 tabular-nums">
              {player.jersey_number != null ? (
                `#${player.jersey_number}`
              ) : (
                <span className="opacity-0">#00</span>
              )}
            </p>
            <p className="font-semibold text-sm">
              {formatPlayerName(player)}
            </p>
            {player.team_role !== "player" && (
              <Badge variant="outline" className={cn("mt-2 text-xs",
                player.team_role === "coach"
                  ? "border-green-500/30 text-green-400"
                  : "border-primary/30 text-primary"
              )}>
                {player.team_role === "captain" ? "C" : player.team_role === "assistant_captain" ? "A" : tr("coach")}
              </Badge>
            )}
          </CardContent>
        </Card>
      </Link>
      <PlayerEditButton
        playerId={player.id}
        className="absolute top-2 right-2 z-10"
      />
    </div>
  );
}
