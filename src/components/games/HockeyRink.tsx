"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { POSITION_COLORS_HEX } from "@/lib/utils/constants";
import type { PlayerPosition, LineupDesignation, SlotPosition, Profile } from "@/types/database";

export interface RinkPlayer {
  player_id: string;
  designation: LineupDesignation;
  position_played: PlayerPosition;
  line_number?: number | null;
  slot_position?: SlotPosition | null;
  player: Profile;
}

interface HockeyRinkProps {
  lineup: RinkPlayer[];
  interactive?: boolean;
  onPlayerClick?: (playerId: string) => void;
}

const SLOT_COORDS: Record<string, { x: number; y: number }> = {
  GK: { x: 300, y: 345 },
  LD: { x: 155, y: 300 },
  RD: { x: 445, y: 300 },
  C: { x: 300, y: 160 },
  LW: { x: 115, y: 70 },
  RW: { x: 485, y: 70 },
};

// Fallback: assign by position type
const POSITION_FALLBACK: Record<string, { x: number; y: number }[]> = {
  goalie: [SLOT_COORDS.GK],
  defense: [SLOT_COORDS.LD, SLOT_COORDS.RD],
  forward: [SLOT_COORDS.LW, SLOT_COORDS.C, SLOT_COORDS.RW],
};

function buildLines(lineup: RinkPlayer[]) {
  const goalies = lineup.filter((p) => p.line_number === 0 || p.slot_position === "GK");
  const lineMap = new Map<number, RinkPlayer[]>();

  for (const p of lineup) {
    if (p.slot_position === "GK" || p.line_number === 0) continue;
    const ln = p.line_number ?? 1;
    if (!lineMap.has(ln)) lineMap.set(ln, []);
    lineMap.get(ln)!.push(p);
  }

  // If no line info at all, create a single line from position types
  if (lineMap.size === 0) {
    const nonGoalies = lineup.filter((p) => p.position_played !== "goalie");
    if (nonGoalies.length > 0) lineMap.set(1, nonGoalies);
    // Also pick goalie from full list if none found
    if (goalies.length === 0) {
      const g = lineup.find((p) => p.position_played === "goalie");
      if (g) goalies.push(g);
    }
  }

  const lineNumbers = [...lineMap.keys()].sort((a, b) => a - b);
  return { goalies, lineNumbers, lineMap };
}

function getPlayersOnIce(
  goalie: RinkPlayer | undefined,
  linePlayers: RinkPlayer[]
): { player: RinkPlayer; x: number; y: number }[] {
  const result: { player: RinkPlayer; x: number; y: number }[] = [];

  if (goalie) {
    result.push({ player: goalie, ...SLOT_COORDS.GK });
  }

  // Try slot_position first
  const slotted = linePlayers.filter((p) => p.slot_position && p.slot_position !== "GK");
  const unslotted = linePlayers.filter((p) => !p.slot_position || p.slot_position === "GK");

  for (const p of slotted) {
    const coords = SLOT_COORDS[p.slot_position!];
    if (coords) result.push({ player: p, ...coords });
  }

  // Fallback for players without slot info
  const usedPositions = new Set(slotted.map((p) => p.slot_position));
  for (const p of unslotted) {
    const slots = POSITION_FALLBACK[p.position_played] ?? [];
    for (const slot of slots) {
      const slotKey = Object.entries(SLOT_COORDS).find(
        ([, v]) => v.x === slot.x && v.y === slot.y
      )?.[0];
      if (slotKey && !usedPositions.has(slotKey as SlotPosition)) {
        result.push({ player: p, ...slot });
        usedPositions.add(slotKey as SlotPosition);
        break;
      }
    }
  }

  return result;
}

export default function HockeyRink({ lineup, interactive, onPlayerClick }: HockeyRinkProps) {
  const [activeLine, setActiveLine] = useState(1);

  if (lineup.length === 0) return null;

  const { goalies, lineNumbers, lineMap } = buildLines(lineup);
  const currentLineNum = lineNumbers.includes(activeLine) ? activeLine : lineNumbers[0] ?? 1;
  const linePlayers = lineMap.get(currentLineNum) ?? [];
  const onIce = getPlayersOnIce(goalies[0], linePlayers);

  // Players not on any line
  const allAssignedIds = new Set([
    ...goalies.map((g) => g.player_id),
    ...[...lineMap.values()].flat().map((p) => p.player_id),
  ]);
  const bench = lineup.filter((p) => !allAssignedIds.has(p.player_id));

  return (
    <div className="w-full">
      {/* Line tabs */}
      {lineNumbers.length > 1 && (
        <div className="flex justify-center gap-2 mb-3">
          {lineNumbers.map((ln) => (
            <button
              key={ln}
              onClick={() => setActiveLine(ln)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                currentLineNum === ln
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {ln}
            </button>
          ))}
        </div>
      )}

      {/* SVG Rink */}
      <div className="relative w-full max-w-2xl mx-auto">
        <svg
          viewBox="0 0 600 480"
          className="w-full h-auto"
          style={{ filter: "drop-shadow(0 0 20px rgba(30, 64, 175, 0.15))" }}
        >
          <defs>
            <linearGradient id="iceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0f4f8" />
              <stop offset="50%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#d5dce6" />
            </linearGradient>
            <clipPath id="rinkClip">
              <path d="M 25 20 H 575 V 365 Q 575 458 480 458 H 120 Q 25 458 25 365 Z" />
            </clipPath>
          </defs>

          {/* Half-rink outline */}
          <path
            d="M 15 10 H 585 V 370 Q 585 470 485 470 H 115 Q 15 470 15 370 Z"
            fill="#1a2744"
            stroke="#2563eb"
            strokeWidth="3"
          />
          {/* Ice surface */}
          <path
            d="M 25 20 H 575 V 365 Q 575 458 480 458 H 120 Q 25 458 25 365 Z"
            fill="url(#iceGradient)"
            stroke="#b0bec5"
            strokeWidth="1"
          />

          {/* Subtle ice texture */}
          <g clipPath="url(#rinkClip)" opacity="0.08">
            <line x1="25" y1="80" x2="575" y2="80" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="25" y1="160" x2="575" y2="160" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="25" y1="240" x2="575" y2="240" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="25" y1="320" x2="575" y2="320" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="25" y1="400" x2="575" y2="400" stroke="#94a3b8" strokeWidth="0.5" />
          </g>

          {/* Center red line */}
          <line x1="15" y1="12" x2="585" y2="12" stroke="#dc2626" strokeWidth="5" />

          {/* Blue line */}
          <line x1="25" y1="120" x2="575" y2="120" stroke="#2563eb" strokeWidth="4" opacity="0.8" />

          {/* Faceoff circles */}
          <circle cx="180" cy="310" r="55" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.25" />
          <circle cx="180" cy="310" r="4" fill="#dc2626" opacity="0.3" />
          <circle cx="420" cy="310" r="55" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.25" />
          <circle cx="420" cy="310" r="4" fill="#dc2626" opacity="0.3" />

          {/* Goal crease */}
          <path
            d="M 265 445 Q 265 415 300 415 Q 335 415 335 445"
            fill="rgba(37, 99, 235, 0.15)"
            stroke="#2563eb"
            strokeWidth="2"
            opacity="0.7"
          />
          <line x1="245" y1="445" x2="355" y2="445" stroke="#dc2626" strokeWidth="3" opacity="0.6" />

          {/* Players */}
          {onIce.map(({ player: entry, x, y }) => {
            const p = entry.player;
            const color = POSITION_COLORS_HEX[entry.position_played];
            const initials = `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`;
            const isCaptain = entry.designation === "captain";
            const isAssistant = entry.designation === "assistant_captain";
            const label = `#${p.jersey_number ?? ""} ${p.last_name}`;
            const clipId = `avatar-clip-${entry.player_id}`;

            return (
              <g
                key={entry.player_id}
                className={interactive ? "cursor-pointer" : ""}
                onClick={() => interactive && onPlayerClick?.(entry.player_id)}
              >
                <defs>
                  <clipPath id={clipId}>
                    <circle cx={x} cy={y} r="35" />
                  </clipPath>
                </defs>
                {/* Glow */}
                <circle cx={x} cy={y} r="44" fill={color} opacity="0.15" />
                {/* Avatar or fallback */}
                {p.avatar_url ? (
                  <>
                    <circle cx={x} cy={y} r="35" fill={color} />
                    <image
                      href={p.avatar_url}
                      x={x - 35}
                      y={y - 35}
                      width="70"
                      height="70"
                      clipPath={`url(#${clipId})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  </>
                ) : (
                  <>
                    <circle cx={x} cy={y} r="35" fill={color} opacity="0.95" />
                    <text
                      x={x}
                      y={y + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize="18"
                      fontWeight="bold"
                      fontFamily="system-ui"
                    >
                      {initials}
                    </text>
                  </>
                )}
                {/* Position color ring */}
                <circle
                  cx={x}
                  cy={y}
                  r="36"
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                />
                {/* Name badge background */}
                <rect
                  x={x - 56}
                  y={y + 40}
                  width="112"
                  height="26"
                  rx="13"
                  fill="rgba(15, 23, 42, 0.9)"
                />
                {/* Name badge text */}
                <text
                  x={x}
                  y={y + 55}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="13"
                  fontWeight="600"
                  fontFamily="system-ui"
                >
                  {label}
                </text>
                {/* Captain/Assistant badge */}
                {(isCaptain || isAssistant) && (
                  <>
                    <circle
                      cx={x + 26}
                      cy={y - 26}
                      r="12"
                      fill="#e8732a"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    <text
                      x={x + 26}
                      y={y - 25}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize="11"
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
