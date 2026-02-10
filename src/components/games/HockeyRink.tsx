"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { POSITION_COLORS_HEX } from "@/lib/utils/constants";
import type { PlayerPosition, LineupDesignation, Profile } from "@/types/database";

export interface RinkPlayer {
  player_id: string;
  designation: LineupDesignation;
  position_played: PlayerPosition;
  player: Profile;
}

interface HockeyRinkProps {
  lineup: RinkPlayer[];
  interactive?: boolean;
  onPlayerClick?: (playerId: string) => void;
}

const RINK_POSITIONS: Record<string, { x: number; y: number }> = {
  goalie: { x: 300, y: 355 },
  defense_left: { x: 170, y: 260 },
  defense_right: { x: 430, y: 260 },
  center: { x: 300, y: 155 },
  left_wing: { x: 120, y: 100 },
  right_wing: { x: 480, y: 100 },
};

function assignPositions(lineup: RinkPlayer[]) {
  const onIce: { player: RinkPlayer; x: number; y: number }[] = [];
  const bench: RinkPlayer[] = [];

  const goalies = lineup.filter((p) => p.position_played === "goalie");
  const defenders = lineup.filter((p) => p.position_played === "defense");
  const forwards = lineup.filter((p) => p.position_played === "forward");

  // Place goalie
  if (goalies[0]) {
    onIce.push({ player: goalies[0], ...RINK_POSITIONS.goalie });
  }

  // Place defensemen (max 2)
  if (defenders[0]) {
    onIce.push({ player: defenders[0], ...RINK_POSITIONS.defense_left });
  }
  if (defenders[1]) {
    onIce.push({ player: defenders[1], ...RINK_POSITIONS.defense_right });
  }

  // Place forwards (max 3: center, LW, RW)
  if (forwards[0]) {
    onIce.push({ player: forwards[0], ...RINK_POSITIONS.center });
  }
  if (forwards[1]) {
    onIce.push({ player: forwards[1], ...RINK_POSITIONS.left_wing });
  }
  if (forwards[2]) {
    onIce.push({ player: forwards[2], ...RINK_POSITIONS.right_wing });
  }

  // Everyone else goes to bench
  const onIceIds = new Set(onIce.map((p) => p.player.player_id));
  lineup.forEach((p) => {
    if (!onIceIds.has(p.player_id)) {
      bench.push(p);
    }
  });

  return { onIce, bench };
}

export default function HockeyRink({ lineup, interactive, onPlayerClick }: HockeyRinkProps) {
  const { onIce, bench } = assignPositions(lineup);

  if (lineup.length === 0) return null;

  return (
    <div className="w-full">
      {/* SVG Rink */}
      <div className="relative w-full max-w-[600px] mx-auto">
        <svg
          viewBox="0 0 600 400"
          className="w-full h-auto"
          style={{ filter: "drop-shadow(0 0 20px rgba(30, 64, 175, 0.15))" }}
        >
          {/* Rink background */}
          <rect
            x="10"
            y="10"
            width="580"
            height="380"
            rx="100"
            ry="100"
            fill="#0f1729"
            stroke="#2563eb"
            strokeWidth="3"
          />

          {/* Ice surface */}
          <rect
            x="20"
            y="20"
            width="560"
            height="360"
            rx="92"
            ry="92"
            fill="#111d35"
            stroke="#1e3a5f"
            strokeWidth="1"
          />

          {/* Center red line */}
          <line x1="300" y1="20" x2="300" y2="380" stroke="#dc2626" strokeWidth="3" />

          {/* Blue lines */}
          <line x1="200" y1="20" x2="200" y2="380" stroke="#2563eb" strokeWidth="2" opacity="0.6" />
          <line x1="400" y1="20" x2="400" y2="380" stroke="#2563eb" strokeWidth="2" opacity="0.6" />

          {/* Center circle */}
          <circle cx="300" cy="200" r="40" fill="none" stroke="#2563eb" strokeWidth="1.5" opacity="0.5" />
          <circle cx="300" cy="200" r="3" fill="#2563eb" opacity="0.5" />

          {/* Center faceoff dot */}
          <circle cx="300" cy="200" r="5" fill="#dc2626" opacity="0.6" />

          {/* Faceoff circles - our zone */}
          <circle cx="170" cy="300" r="30" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.3" />
          <circle cx="170" cy="300" r="3" fill="#dc2626" opacity="0.4" />
          <circle cx="430" cy="300" r="30" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.3" />
          <circle cx="430" cy="300" r="3" fill="#dc2626" opacity="0.4" />

          {/* Faceoff circles - attacking zone */}
          <circle cx="170" cy="100" r="30" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.3" />
          <circle cx="170" cy="100" r="3" fill="#dc2626" opacity="0.4" />
          <circle cx="430" cy="100" r="30" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.3" />
          <circle cx="430" cy="100" r="3" fill="#dc2626" opacity="0.4" />

          {/* Goal crease - our goal (bottom) */}
          <path
            d="M 275 385 Q 275 365 300 365 Q 325 365 325 385"
            fill="rgba(37, 99, 235, 0.1)"
            stroke="#2563eb"
            strokeWidth="1.5"
            opacity="0.5"
          />
          {/* Goal line - bottom */}
          <line x1="260" y1="385" x2="340" y2="385" stroke="#dc2626" strokeWidth="2" opacity="0.4" />

          {/* Goal crease - opponent's goal (top) */}
          <path
            d="M 275 15 Q 275 35 300 35 Q 325 35 325 15"
            fill="rgba(37, 99, 235, 0.1)"
            stroke="#2563eb"
            strokeWidth="1.5"
            opacity="0.5"
          />
          {/* Goal line - top */}
          <line x1="260" y1="15" x2="340" y2="15" stroke="#dc2626" strokeWidth="2" opacity="0.4" />

          {/* Player nodes on ice */}
          {onIce.map(({ player: entry, x, y }) => {
            const p = entry.player;
            const color = POSITION_COLORS_HEX[entry.position_played];
            const initials = `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`;
            const isCaptain = entry.designation === "captain";
            const isAssistant = entry.designation === "assistant_captain";

            return (
              <g
                key={entry.player_id}
                className={interactive ? "cursor-pointer" : ""}
                onClick={() => interactive && onPlayerClick?.(entry.player_id)}
              >
                {/* Glow */}
                <circle cx={x} cy={y} r="26" fill={color} opacity="0.15" />
                {/* Main circle */}
                <circle
                  cx={x}
                  cy={y}
                  r="20"
                  fill={color}
                  stroke="white"
                  strokeWidth="2"
                  opacity="0.9"
                />
                {/* Initials */}
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="system-ui"
                >
                  {initials}
                </text>
                {/* Jersey number */}
                <text
                  x={x}
                  y={y + 33}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="system-ui"
                  opacity="0.9"
                >
                  #{p.jersey_number ?? ""}
                </text>
                {/* Last name */}
                <text
                  x={x}
                  y={y + 45}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontFamily="system-ui"
                  opacity="0.7"
                >
                  {p.last_name}
                </text>
                {/* Captain/Assistant badge */}
                {(isCaptain || isAssistant) && (
                  <>
                    <circle
                      cx={x + 15}
                      cy={y - 15}
                      r="8"
                      fill="#e8732a"
                      stroke="white"
                      strokeWidth="1"
                    />
                    <text
                      x={x + 15}
                      y={y - 14}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily="system-ui"
                    >
                      {isCaptain ? "C" : "A"}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2 text-center uppercase tracking-wider">
            Bench
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {bench.map((entry) => {
              const p = entry.player;
              const initials = `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`;
              return (
                <div
                  key={entry.player_id}
                  className={`flex items-center gap-2 py-1.5 px-3 rounded-full bg-secondary/50 border border-border/30 ${
                    interactive ? "cursor-pointer hover:bg-secondary/80" : ""
                  }`}
                  onClick={() => interactive && onPlayerClick?.(entry.player_id)}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-secondary text-[10px] font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">
                    <span className="text-primary">#{p.jersey_number ?? ""}</span>{" "}
                    {p.last_name}
                  </span>
                  <Badge
                    className={`text-[9px] px-1 py-0 ${
                      POSITION_COLORS_HEX[entry.position_played] === "#e8732a"
                        ? "bg-team-orange text-white"
                        : entry.position_played === "defense"
                          ? "bg-blue-600 text-white"
                          : "bg-team-silver text-white"
                    }`}
                  >
                    {entry.position_played === "forward"
                      ? "FW"
                      : entry.position_played === "defense"
                        ? "DF"
                        : "GK"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
