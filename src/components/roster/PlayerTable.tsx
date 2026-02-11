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
import { useRouter } from "@/i18n/navigation";
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
    const router = useRouter();

    return (
        <div className="rounded-md border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-15 sm:w-20 text-center">#</TableHead>
                            <TableHead className="min-w-50">{t("player")}</TableHead>
                            <TableHead className="min-w-25">{t("position")}</TableHead>
                            <TableHead className="hidden md:table-cell min-w-25">{t("role")}</TableHead>
                            <TableHead className="hidden sm:table-cell text-right min-w-20">{t("height")}</TableHead>
                            <TableHead className="hidden sm:table-cell text-right min-w-20">{t("weight")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {players.map((player) => {
                            const positionColor = POSITION_COLORS[player.position] || "bg-gray-500/20 text-gray-400 border-gray-500/30";

                            return (
                                <TableRow
                                    key={player.id}
                                    className="hover:bg-muted/50 cursor-pointer group"
                                    onClick={() => router.push(`/roster/${player.id}`)}
                                >
                                    <TableCell className="font-mono text-center font-bold text-lg text-muted-foreground">
                                        {player.jersey_number ?? "-"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border border-border/50 ring-0 group-hover:ring-2 group-hover:ring-primary/30 transition-all">
                                                <AvatarImage src={player.avatar_url || undefined} alt={`${player.first_name} ${player.last_name}`} />
                                                <AvatarFallback className="text-xs bg-secondary">
                                                    {player.first_name[0]}{player.last_name[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-foreground truncate">
                                                    {formatPlayerName(player)}
                                                </span>
                                                {player.nickname && (
                                                    <span className="text-xs text-muted-foreground truncate">"{player.nickname}"</span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("capitalize whitespace-nowrap text-xs", positionColor)}>
                                            {tp(player.position)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {player.team_role !== "player" && (
                                            <Badge variant="secondary" className="capitalize text-xs">
                                                {t(player.team_role)}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-right font-mono text-muted-foreground text-sm">
                                        {player.height ? `${player.height} cm` : "-"}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-right font-mono text-muted-foreground text-sm">
                                        {player.weight ? `${player.weight} kg` : "-"}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
