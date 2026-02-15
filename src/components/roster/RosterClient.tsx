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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Profile, PlayerPosition } from "@/types/database";
import { POSITION_COLORS } from "@/lib/utils/constants";
import { formatPlayerName } from "@/lib/utils/player-name";
import { LayoutGrid, List } from "lucide-react";
import { PlayerEditButton } from "@/components/players/PlayerEditButton";
import { PlayerTable } from "./PlayerTable";

type RosterSort = "name" | "number";
type SortDirection = "asc" | "desc";
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

  const [sortBy, setSortBy] = useState<RosterSort>("number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
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
    const sorted = [...filteredPlayers];

    const byName = (a: Profile, b: Profile) =>
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);

    sorted.sort((a, b) => {
      if (sortBy === "number") {
        if (a.jersey_number === null && b.jersey_number === null) {
          return byName(a, b);
        }
        if (a.jersey_number === null) return 1;
        if (b.jersey_number === null) return -1;
        const numberDiff = a.jersey_number - b.jersey_number;
        return numberDiff || byName(a, b);
      }

      return byName(a, b);
    });

    if (sortDirection === "desc") {
      sorted.reverse();
    }

    return sorted;
  }, [filteredPlayers, sortBy, sortDirection]);

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

        <div className="flex flex-col sm:flex-row gap-4 sm:items-end justify-between">
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
            <div className="space-y-2">
              <Label id="sort-by-label">{t("sortBy")}</Label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as RosterSort)}>
                <SelectTrigger aria-labelledby="sort-by-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">{t("sortByNumber")}</SelectItem>
                  <SelectItem value="name">{t("sortByName")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label id="sort-direction-label">{t("sortDirection")}</Label>
              <Select
                value={sortDirection}
                onValueChange={(value) => setSortDirection(value as SortDirection)}
              >
                <SelectTrigger aria-labelledby="sort-direction-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">{t("sortAsc")}</SelectItem>
                  <SelectItem value="desc">{t("sortDesc")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start sm:self-end">
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
  const tp = useTranslations("positions");
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
            {player.position && (
              <Badge
                variant="secondary"
                className={`mt-2 text-xs ${POSITION_COLORS[player.position as PlayerPosition]}`}
              >
                {tp(player.position)}
              </Badge>
            )}
            {player.team_role !== "player" && (
              <Badge variant="outline" className={cn("mt-1 text-xs",
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
