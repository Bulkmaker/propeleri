"use client";

import { Profile } from "@/types/database";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "next-intl";
import { formatPlayerName } from "@/lib/utils/player-name";
import { Badge } from "@/components/ui/badge";
import { POSITION_COLORS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils";

interface PlayerTableProps {
    players: Profile[];
}

export function PlayerTable({ players }: PlayerTableProps) {
    const t = useTranslations("roster");
    const tp = useTranslations("positions");
    const tc = useTranslations("common");

    return (
        <div className="rounded-md border border-border/50 bg-card/50 backdrop-blur-sm">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[80px] text-center">#</TableHead>
                        <TableHead>{t("player")}</TableHead>
                        <TableHead>{t("position")}</TableHead>
                        <TableHead className="hidden md:table-cell">{t("role")}</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">{t("height")}</TableHead>
                        <TableHead className="hidden sm:table-cell text-right">{t("weight")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {players.map((player) => {
                        const positionColor = POSITION_COLORS[player.position] || "bg-gray-500/20 text-gray-400 border-gray-500/30";

                        return (
                            <TableRow key={player.id} className="hover:bg-muted/50">
                                <TableCell className="font-mono text-center font-bold text-lg text-muted-foreground">
                                    {player.jersey_number ?? "-"}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border border-border/50">
                                            <AvatarImage src={player.avatar_url || undefined} alt={`${player.first_name} ${player.last_name}`} />
                                            <AvatarFallback className="text-xs bg-secondary">
                                                {player.first_name[0]}{player.last_name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-foreground">
                                                {formatPlayerName(player)}
                                            </span>
                                            {player.nickname && (
                                                <span className="text-xs text-muted-foreground">"{player.nickname}"</span>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn("capitalize whitespace-nowrap", positionColor)}>
                                        {tp(player.position)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                    {player.team_role !== "player" && (
                                        <Badge variant="secondary" className="capitalize">
                                            {t(player.team_role)}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-right font-mono text-muted-foreground">
                                    {player.height ? `${player.height} cm` : "-"}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-right font-mono text-muted-foreground">
                                    {player.weight ? `${player.weight} kg` : "-"}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
