import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import { POSITION_RING_COLORS } from "@/lib/utils/constants";
import type { PlayerPosition } from "@/types/database";

export interface PlayerStatRow {
  player_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  position: string | null;
  avatar_url: string | null;
  appearances: number;
  goals: number;
  assists: number;
  points: number;
  penalty_minutes: number;
}

interface PlayerStatsTableProps {
  players: PlayerStatRow[];
  labels: {
    appearances: string;
    goals: string;
    assists: string;
    points: string;
    penaltyMinutes: string;
    player: string;
  };
  positionLabel?: (key: string) => string;
  showPenalties?: boolean;
}

export function PlayerStatsTable({
  players,
  labels,
  positionLabel,
  showPenalties = true,
}: PlayerStatsTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>{labels.player}</TableHead>
            <TableHead className="text-center">{labels.appearances}</TableHead>
            <TableHead className="text-center">{labels.goals}</TableHead>
            <TableHead className="text-center">{labels.assists}</TableHead>
            <TableHead className="text-center">{labels.points}</TableHead>
            {showPenalties && (
              <TableHead className="text-center">{labels.penaltyMinutes}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player, idx) => {
            const initials = `${player.first_name[0] ?? ""}${player.last_name[0] ?? ""}`;
            const ringColor = player.position
              ? POSITION_RING_COLORS[player.position as PlayerPosition] ?? ""
              : "";

            return (
              <TableRow key={player.player_id}>
                <TableCell className="font-medium text-muted-foreground">
                  {idx + 1}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/roster/${player.player_id}`}
                    className="flex items-center gap-2 hover:text-primary transition-colors group"
                  >
                    <Avatar className={`h-8 w-8 ring-2 ${ringColor} shrink-0`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <AvatarImage
                        src={player.avatar_url ?? undefined}
                        alt={`${player.first_name} ${player.last_name}`}
                      />
                      <AvatarFallback className="text-xs bg-secondary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-primary font-bold text-sm">
                      {player.jersey_number ?? "-"}
                    </span>
                    <span className="font-medium">
                      {player.first_name} {player.last_name}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-center">{player.appearances}</TableCell>
                <TableCell className="text-center font-semibold">{player.goals}</TableCell>
                <TableCell className="text-center">{player.assists}</TableCell>
                <TableCell className="text-center font-bold text-primary">
                  {player.points}
                </TableCell>
                {showPenalties && (
                  <TableCell className="text-center">{player.penalty_minutes}</TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
