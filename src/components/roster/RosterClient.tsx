"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type RosterSort = "name" | "number";
type SortDirection = "asc" | "desc";

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

  const forwards = sortedPlayers.filter((player) => player.position === "forward");
  const defense = sortedPlayers.filter((player) => player.position === "defense");
  const goalies = sortedPlayers.filter((player) => player.position === "goalie");

  return (
    <div className="space-y-8">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="roster-search">{tc("search")}</Label>
          <Input
            id="roster-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlayersPlaceholder")}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("sortBy")}</Label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as RosterSort)}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">{t("sortByNumber")}</SelectItem>
              <SelectItem value="name">{t("sortByName")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("sortDirection")}</Label>
          <Select
            value={sortDirection}
            onValueChange={(value) => setSortDirection(value as SortDirection)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{t("sortAsc")}</SelectItem>
              <SelectItem value="desc">{t("sortDesc")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sortedPlayers.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p>{tc("noData")}</p>
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
  const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`;

  return (
    <Link href={`/roster/${player.id}`}>
      <Card className="border-border/40 card-hover bg-card group cursor-pointer h-full">
        <CardContent className="p-4 text-center">
          <Avatar className="h-20 w-20 mx-auto mb-3 ring-2 ring-border group-hover:ring-primary/50 transition-all">
            <AvatarImage src={player.avatar_url ?? undefined} />
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
