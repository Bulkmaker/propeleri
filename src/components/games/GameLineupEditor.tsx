"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Loader2, Plus, Trash2, X, Check } from "lucide-react";
import type { Profile, PlayerPosition, LineupDesignation, SlotPosition, GameLineup } from "@/types/database";
import { POSITION_COLORS, POSITION_COLORS_HEX, SLOT_TO_POSITION } from "@/lib/utils/constants";

// A slot holds a player assignment
interface SlotAssignment {
  playerId: string | null;
  designation: LineupDesignation;
}

// A line is a set of 5 slots (LW, C, RW, LD, RD)
interface LineData {
  slots: Record<"LW" | "C" | "RW" | "LD" | "RD", SlotAssignment>;
}

const EMPTY_SLOT: SlotAssignment = { playerId: null, designation: "player" };
const SLOT_LABEL_KEYS: Record<Exclude<SlotPosition, "GK">, "lw" | "c" | "rw" | "ld" | "rd"> = {
  LW: "lw",
  C: "c",
  RW: "rw",
  LD: "ld",
  RD: "rd",
};

type SavedLineupEntry = Omit<GameLineup, "line_number"> & {
  line_number: number | null;
  slot_position: SlotPosition | null;
};

function createEmptyLine(): LineData {
  return {
    slots: {
      LW: { ...EMPTY_SLOT },
      C: { ...EMPTY_SLOT },
      RW: { ...EMPTY_SLOT },
      LD: { ...EMPTY_SLOT },
      RD: { ...EMPTY_SLOT },
    },
  };
}

// Exported type for read-only mode (used by public pages)
export interface ReadOnlyPlayer {
  player_id: string;
  designation: LineupDesignation;
  position_played: PlayerPosition;
  line_number: number | null;
  slot_position: SlotPosition | null;
  player: Profile;
}

interface GameLineupEditorProps {
  gameId: string;
  embedded?: boolean;
  backHref?: string | null;
  onSaved?: () => void;
  readOnly?: boolean;
  lineup?: ReadOnlyPlayer[];
}

const SLOT_POSITIONS: Record<string, { left: string; top: string }> = {
  LW: { left: "20%", top: "15%" },
  C: { left: "50%", top: "33%" },
  RW: { left: "80%", top: "15%" },
  LD: { left: "27%", top: "56%" },
  RD: { left: "73%", top: "56%" },
  GK: { left: "50%", top: "70%" },
};

export function GameLineupEditor({
  gameId,
  embedded = false,
  backHref,
  onSaved,
  readOnly = false,
  lineup: readOnlyLineup,
}: GameLineupEditorProps) {
  const t = useTranslations("game");
  const tp = useTranslations("positions");
  const tc = useTranslations("common");

  const [players, setPlayers] = useState<Profile[]>([]);
  const [goalieSlots, setGoalieSlots] = useState<SlotAssignment[]>([
    { ...EMPTY_SLOT },
    { ...EMPTY_SLOT },
  ]);
  const [lines, setLines] = useState<LineData[]>([createEmptyLine()]);
  const [loading, setLoading] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const initialLoadDone = useRef(false);
  const isSavingRef = useRef(false);
  const [isTournamentGame, setIsTournamentGame] = useState(false);
  const [registeredPlayersCount, setRegisteredPlayersCount] = useState<number | null>(null);

  // Drag state (only used in edit mode)
  const [dragSource, setDragSource] = useState<{
    type: "goalie" | "line" | "available";
    lineIndex?: number;
    slot?: string;
    goalieIndex?: number;
    playerId?: string;
  } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Read-only mode: build state from props
  useEffect(() => {
    if (!readOnly || !readOnlyLineup) return;

    const goalies: SlotAssignment[] = [];
    const lineMap = new Map<number, LineData>();
    const playersList: Profile[] = [];

    for (const entry of readOnlyLineup) {
      playersList.push(entry.player);

      if (entry.slot_position === "GK" || (entry.position_played === "goalie" && !entry.slot_position)) {
        goalies.push({
          playerId: entry.player_id,
          designation: entry.designation,
        });
      } else if (entry.slot_position) {
        const lineNum = entry.line_number ?? 1;
        if (!lineMap.has(lineNum)) lineMap.set(lineNum, createEmptyLine());
        const line = lineMap.get(lineNum)!;
        const slot = entry.slot_position as keyof LineData["slots"];
        if (slot in line.slots) {
          line.slots[slot] = {
            playerId: entry.player_id,
            designation: entry.designation,
          };
        }
      }
    }

    while (goalies.length < 1) goalies.push({ ...EMPTY_SLOT });
    setGoalieSlots(goalies);

    const sortedLineNums = [...lineMap.keys()].sort((a, b) => a - b);
    const loadedLines = sortedLineNums.map((n) => lineMap.get(n)!);
    if (loadedLines.length === 0) loadedLines.push(createEmptyLine());
    setLines(loadedLines);

    setPlayers(playersList);
    setLoading(false);
  }, [readOnly, readOnlyLineup]);

  // Edit mode: load from Supabase
  useEffect(() => {
    if (readOnly) return;

    async function load() {
      const [gameRes, lineupRes] = await Promise.all([
        supabase
          .from("games")
          .select("tournament_id")
          .eq("id", gameId)
          .maybeSingle(),
        supabase
          .from("game_lineups")
          .select("*, player:profiles(*)")
          .eq("game_id", gameId)
          .order("line_number")
          .order("slot_position"),
      ]);
      const tournamentId = gameRes.data?.tournament_id ?? null;
      setIsTournamentGame(Boolean(tournamentId));

      let selectablePlayers: Profile[] = [];

      if (tournamentId) {
        const { data: registrations } = await supabase
          .from("tournament_player_registrations")
          .select("player_id")
          .eq("tournament_id", tournamentId);

        const declaredPlayerIds = ((registrations ?? []) as { player_id: string }[]).map(
          (row) => row.player_id
        );
        setRegisteredPlayersCount(declaredPlayerIds.length);

        if (declaredPlayerIds.length > 0) {
          const { data: declaredPlayers } = await supabase
            .from("profiles")
            .select("*")
            .eq("is_active", true)
            .eq("is_approved", true)
            .in("id", declaredPlayerIds)
            .order("jersey_number");

          selectablePlayers = (declaredPlayers ?? []) as Profile[];
        } else {
          const { data: fallbackPlayers } = await supabase
            .from("profiles")
            .select("*")
            .eq("is_active", true)
            .eq("is_approved", true)
            .order("jersey_number");

          selectablePlayers = (fallbackPlayers ?? []) as Profile[];
        }
      } else {
        const { data: allPlayers } = await supabase
          .from("profiles")
          .select("*")
          .eq("is_active", true)
          .eq("is_approved", true)
          .order("jersey_number");

        selectablePlayers = (allPlayers ?? []) as Profile[];
        setRegisteredPlayersCount(null);
      }

      const entries = (lineupRes.data ?? []) as SavedLineupEntry[];

      const lineupPlayers = entries
        .map((entry) => {
          const candidate = entry.player as unknown;
          if (Array.isArray(candidate)) {
            return (candidate[0] ?? null) as Profile | null;
          }
          return candidate as Profile | null;
        })
        .filter((player): player is Profile => Boolean(player));

      const mergedPlayers = new Map<string, Profile>();
      for (const player of selectablePlayers) mergedPlayers.set(player.id, player);
      for (const player of lineupPlayers) mergedPlayers.set(player.id, player);

      setPlayers(
        Array.from(mergedPlayers.values()).sort((a, b) => {
          const aNumber = a.jersey_number ?? 999;
          const bNumber = b.jersey_number ?? 999;
          if (aNumber !== bNumber) return aNumber - bNumber;
          return `${a.first_name} ${a.last_name}`.localeCompare(
            `${b.first_name} ${b.last_name}`
          );
        })
      );

      if (entries.length > 0) {
        // Rebuild state from saved data
        const goalies: SlotAssignment[] = [];
        const lineMap = new Map<number, LineData>();

        for (const entry of entries) {
          if (entry.slot_position === "GK") {
            goalies.push({
              playerId: entry.player_id,
              designation: entry.designation,
            });
          } else if (entry.slot_position && entry.line_number !== null) {
            const lineNum = entry.line_number;
            if (!lineMap.has(lineNum)) {
              lineMap.set(lineNum, createEmptyLine());
            }
            const line = lineMap.get(lineNum)!;
            const slot = entry.slot_position as keyof LineData["slots"];
            if (slot in line.slots) {
              line.slots[slot] = {
                playerId: entry.player_id,
                designation: entry.designation,
              };
            }
          } else {
            // Legacy entry without slot_position — treat as unassigned goalie or guess
            if (entry.position_played === "goalie") {
              goalies.push({
                playerId: entry.player_id,
                designation: entry.designation,
              });
            }
          }
        }

        // Ensure at least 2 goalie slots
        while (goalies.length < 2) goalies.push({ ...EMPTY_SLOT });
        setGoalieSlots(goalies);

        // Sort lines by number
        const sortedLineNums = [...lineMap.keys()].sort((a, b) => a - b);
        const loadedLines = sortedLineNums.map((n) => lineMap.get(n)!);
        if (loadedLines.length === 0) loadedLines.push(createEmptyLine());
        setLines(loadedLines);
      }

      setLoading(false);
      // Mark initial load as done after two ticks so React effects settle first
      requestAnimationFrame(() => {
        initialLoadDone.current = true;
      });
    }
    load();
  }, [gameId, supabase, readOnly]);

  // Get all assigned player IDs
  const assignedPlayerIds = useCallback(() => {
    const ids = new Set<string>();
    for (const g of goalieSlots) {
      if (g.playerId) ids.add(g.playerId);
    }
    for (const line of lines) {
      for (const slot of Object.values(line.slots)) {
        if (slot.playerId) ids.add(slot.playerId);
      }
    }
    return ids;
  }, [goalieSlots, lines]);

  const availablePlayers = players.filter((p) => !assignedPlayerIds().has(p.id));

  // Get player by ID
  function getPlayer(id: string | null): Profile | undefined {
    if (!id) return undefined;
    return players.find((p) => p.id === id);
  }

  // Sort players: matching position first
  function sortedPlayersForSlot(slotPos: SlotPosition): Profile[] {
    const targetPosition = SLOT_TO_POSITION[slotPos];
    return [...availablePlayers].sort((a, b) => {
      const aMatch = a.position === targetPosition ? 0 : 1;
      const bMatch = b.position === targetPosition ? 0 : 1;
      return aMatch - bMatch || (a.jersey_number ?? 99) - (b.jersey_number ?? 99);
    });
  }

  // Assign player to goalie slot
  function assignGoalie(index: number, playerId: string) {
    setGoalieSlots((prev) => {
      const next = [...prev];
      next[index] = { playerId, designation: "player" };
      return next;
    });
  }

  // Clear goalie slot
  function clearGoalie(index: number) {
    setGoalieSlots((prev) => {
      const next = [...prev];
      next[index] = { ...EMPTY_SLOT };
      return next;
    });
  }

  // Assign player to line slot
  function assignLineSlot(lineIndex: number, slot: keyof LineData["slots"], playerId: string) {
    setLines((prev) => {
      const next = prev.map((l, i) => {
        if (i !== lineIndex) return l;
        return {
          slots: {
            ...l.slots,
            [slot]: { playerId, designation: "player" } as SlotAssignment,
          },
        };
      });
      return next;
    });
  }

  // Clear line slot
  function clearLineSlot(lineIndex: number, slot: keyof LineData["slots"]) {
    setLines((prev) => {
      const next = prev.map((l, i) => {
        if (i !== lineIndex) return l;
        return {
          slots: {
            ...l.slots,
            [slot]: { ...EMPTY_SLOT },
          },
        };
      });
      return next;
    });
  }

  // Update designation
  function toggleDesignation(
    type: "goalie" | "line",
    lineIndex: number,
    slot?: keyof LineData["slots"],
    goalieIndex?: number
  ) {
    if (type === "goalie" && goalieIndex !== undefined) {
      setGoalieSlots((prev) => {
        const next = [...prev];
        const current = next[goalieIndex].designation;
        next[goalieIndex] = {
          ...next[goalieIndex],
          designation:
            current === "player"
              ? "captain"
              : current === "captain"
                ? "assistant_captain"
                : "player",
        };
        return next;
      });
    } else if (type === "line" && slot) {
      setLines((prev) => {
        return prev.map((l, i) => {
          if (i !== lineIndex) return l;
          const current = l.slots[slot].designation;
          return {
            slots: {
              ...l.slots,
              [slot]: {
                ...l.slots[slot],
                designation:
                  current === "player"
                    ? "captain"
                    : current === "captain"
                      ? "assistant_captain"
                      : "player",
              },
            },
          };
        });
      });
    }
  }

  // Add/remove lines
  function addLine() {
    setLines((prev) => [...prev, createEmptyLine()]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  // Drag and drop handlers
  function handleDragStart(
    e: React.DragEvent,
    source: typeof dragSource
  ) {
    if (!source) return;
    setDragSource(source);
    e.dataTransfer.effectAllowed = "move";
    const pid =
      source.type === "available"
        ? source.playerId
        : source.type === "goalie"
          ? goalieSlots[source.goalieIndex!]?.playerId
          : lines[source.lineIndex!]?.slots[source.slot! as keyof LineData["slots"]]?.playerId;
    e.dataTransfer.setData("text/plain", pid || "");
  }

  function handleDrop(
    e: React.DragEvent,
    target: { type: "goalie" | "line"; lineIndex?: number; slot?: string; goalieIndex?: number }
  ) {
    e.preventDefault();
    const playerId = e.dataTransfer.getData("text/plain");
    if (!playerId || !dragSource) return;

    if (dragSource.type === "goalie" && dragSource.goalieIndex !== undefined) {
      let targetPlayerId: string | null = null;
      if (target.type === "goalie" && target.goalieIndex !== undefined) {
        targetPlayerId = goalieSlots[target.goalieIndex]?.playerId ?? null;
      } else if (target.type === "line" && target.lineIndex !== undefined && target.slot) {
        targetPlayerId = lines[target.lineIndex]?.slots[target.slot as keyof LineData["slots"]]?.playerId ?? null;
      }
      clearGoalie(dragSource.goalieIndex);
      if (targetPlayerId) {
        assignGoalie(dragSource.goalieIndex, targetPlayerId);
      }
    } else if (dragSource.type === "line" && dragSource.lineIndex !== undefined && dragSource.slot) {
      let targetPlayerId: string | null = null;
      if (target.type === "goalie" && target.goalieIndex !== undefined) {
        targetPlayerId = goalieSlots[target.goalieIndex]?.playerId ?? null;
      } else if (target.type === "line" && target.lineIndex !== undefined && target.slot) {
        targetPlayerId = lines[target.lineIndex]?.slots[target.slot as keyof LineData["slots"]]?.playerId ?? null;
      }
      clearLineSlot(dragSource.lineIndex, dragSource.slot as keyof LineData["slots"]);
      if (targetPlayerId) {
        assignLineSlot(dragSource.lineIndex, dragSource.slot as keyof LineData["slots"], targetPlayerId);
      }
    }

    if (target.type === "goalie" && target.goalieIndex !== undefined) {
      assignGoalie(target.goalieIndex, playerId);
    } else if (target.type === "line" && target.lineIndex !== undefined && target.slot) {
      assignLineSlot(target.lineIndex, target.slot as keyof LineData["slots"], playerId);
    }

    setDragSource(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  // Build save entries from current state
  function buildSaveEntries() {
    const entries: {
      game_id: string;
      player_id: string;
      designation: LineupDesignation;
      position_played: PlayerPosition;
      line_number: number;
      slot_position: SlotPosition;
    }[] = [];

    goalieSlots.forEach((g) => {
      if (g.playerId) {
        entries.push({
          game_id: gameId,
          player_id: g.playerId,
          designation: g.designation,
          position_played: "goalie",
          line_number: 0,
          slot_position: "GK",
        });
      }
    });

    lines.forEach((line, lineIndex) => {
      for (const [slotKey, assignment] of Object.entries(line.slots)) {
        if (assignment.playerId) {
          entries.push({
            game_id: gameId,
            player_id: assignment.playerId,
            designation: assignment.designation,
            position_played: SLOT_TO_POSITION[slotKey as SlotPosition],
            line_number: lineIndex + 1,
            slot_position: slotKey as SlotPosition,
          });
        }
      }
    });

    return entries;
  }

  // Auto-save
  async function doSave() {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setAutoSaveStatus("saving");

    try {
      await supabase.from("game_lineups").delete().eq("game_id", gameId);
      const entries = buildSaveEntries();
      if (entries.length > 0) {
        await supabase.from("game_lineups").insert(entries);
      }
      setAutoSaveStatus("saved");
      onSaved?.();
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    } finally {
      isSavingRef.current = false;
    }
  }

  // Auto-save on lineup changes (edit mode only)
  useEffect(() => {
    if (readOnly) return;
    if (!initialLoadDone.current || loading) return;

    const timer = setTimeout(() => {
      void doSave();
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalieSlots, lines, readOnly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalAssigned = assignedPlayerIds().size;
  const resolvedBackHref = backHref === undefined ? `/games/${gameId}` : backHref;

  // Check if second goalie slot has a player (for read-only, hide empty second slot)
  const hasSecondGoalie = goalieSlots.length > 1 && goalieSlots[1].playerId;

  return (
    <div className={embedded ? "w-full" : "container mx-auto px-4 py-8 max-w-4xl"}>
      {!embedded && resolvedBackHref && !readOnly && (
        <Link
          href={resolvedBackHref}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {tc("back")}
        </Link>
      )}

      {!readOnly && (
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t("selectLineup")}</h1>
          <Badge variant="secondary" className="text-sm">
            {totalAssigned} {t("lineup").toLowerCase()}
          </Badge>
        </div>
      )}

      {!readOnly && isTournamentGame && (
        <p className="text-xs text-muted-foreground mb-4">
          {registeredPlayersCount && registeredPlayersCount > 0
            ? `Tournament roster: ${registeredPlayersCount} players`
            : "Tournament roster is not selected yet. Showing all active players."}
        </p>
      )}

      {/* Line tabs */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {lines.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveLineIndex(i)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              activeLineIndex === i
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
            }`}
          >
            {readOnly ? `${i + 1} ${t("line").toLowerCase()}` : i + 1}
          </button>
        ))}
        {!readOnly && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-dashed border-border/60 text-muted-foreground hover:text-foreground"
              onClick={addLine}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("addLine")}
            </Button>
            {lines.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-muted-foreground hover:text-destructive ml-auto"
                onClick={() => {
                  removeLine(activeLineIndex);
                  if (activeLineIndex >= lines.length - 1) setActiveLineIndex(Math.max(0, activeLineIndex - 1));
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t("removeLine")}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Rink with slots */}
      <div className="relative w-full max-w-2xl mx-auto mb-6">
        {/* SVG Rink background */}
        <svg
          viewBox="0 0 600 520"
          className="w-full h-auto"
          style={{ filter: "drop-shadow(0 0 20px rgba(30, 64, 175, 0.15))" }}
        >
          <defs>
            <linearGradient id="iceGradientEditor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0f4f8" />
              <stop offset="50%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#d5dce6" />
            </linearGradient>
            <clipPath id="rinkClipEditor">
              <path d="M 25 20 H 575 V 400 Q 575 500 480 500 H 120 Q 25 500 25 400 Z" />
            </clipPath>
          </defs>
          <path
            d="M 15 10 H 585 V 405 Q 585 510 485 510 H 115 Q 15 510 15 405 Z"
            fill="#1a2744"
            stroke="#2563eb"
            strokeWidth="3"
          />
          <path
            d="M 25 20 H 575 V 400 Q 575 500 480 500 H 120 Q 25 500 25 400 Z"
            fill="url(#iceGradientEditor)"
            stroke="#b0bec5"
            strokeWidth="1"
          />
          <g clipPath="url(#rinkClipEditor)" opacity="0.08">
            <line x1="25" y1="100" x2="575" y2="100" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="25" y1="200" x2="575" y2="200" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="25" y1="300" x2="575" y2="300" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="25" y1="400" x2="575" y2="400" stroke="#94a3b8" strokeWidth="0.5" />
          </g>
          <line x1="15" y1="12" x2="585" y2="12" stroke="#dc2626" strokeWidth="5" />
          <line x1="25" y1="140" x2="575" y2="140" stroke="#2563eb" strokeWidth="4" opacity="0.8" />
          <circle cx="180" cy="340" r="55" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.25" />
          <circle cx="180" cy="340" r="4" fill="#dc2626" opacity="0.3" />
          <circle cx="420" cy="340" r="55" fill="none" stroke="#dc2626" strokeWidth="1" opacity="0.25" />
          <circle cx="420" cy="340" r="4" fill="#dc2626" opacity="0.3" />
          <path
            d="M 265 480 Q 265 450 300 450 Q 335 450 335 480"
            fill="rgba(37, 99, 235, 0.15)"
            stroke="#2563eb"
            strokeWidth="2"
            opacity="0.7"
          />
          <line x1="245" y1="480" x2="355" y2="480" stroke="#dc2626" strokeWidth="3" opacity="0.6" />
        </svg>

        {/* Overlaid position slots */}
        {(() => {
          const lineIndex = activeLineIndex;
          const line = lines[lineIndex];
          if (!line) return null;

          return (
            <>
              {/* Line slot positions */}
              {(["LW", "C", "RW", "LD", "RD"] as const).map((slotKey) => (
                <div
                  key={`${lineIndex}-${slotKey}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: SLOT_POSITIONS[slotKey].left, top: SLOT_POSITIONS[slotKey].top }}
                >
                  <PositionSlot
                    slotPosition={slotKey}
                    label={t(SLOT_LABEL_KEYS[slotKey])}
                    assignment={line.slots[slotKey]}
                    player={getPlayer(line.slots[slotKey].playerId)}
                    availablePlayers={sortedPlayersForSlot(slotKey)}
                    positionTranslations={tp}
                    gameTranslations={t}
                    readOnly={readOnly}
                    onAssign={(pid) => assignLineSlot(lineIndex, slotKey, pid)}
                    onClear={() => clearLineSlot(lineIndex, slotKey)}
                    onToggleDesignation={() => toggleDesignation("line", lineIndex, slotKey)}
                    onDragStart={(e) => handleDragStart(e, { type: "line", lineIndex, slot: slotKey })}
                    onDrop={(e) => handleDrop(e, { type: "line", lineIndex, slot: slotKey })}
                    onDragOver={handleDragOver}
                  />
                </div>
              ))}

              {/* Goalie on rink */}
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: SLOT_POSITIONS.GK.left, top: SLOT_POSITIONS.GK.top }}
              >
                <PositionSlot
                  slotPosition="GK"
                  label={t("gk")}
                  assignment={goalieSlots[0]}
                  player={getPlayer(goalieSlots[0].playerId)}
                  availablePlayers={sortedPlayersForSlot("GK")}
                  positionTranslations={tp}
                  gameTranslations={t}
                  readOnly={readOnly}
                  onAssign={(pid) => assignGoalie(0, pid)}
                  onClear={() => clearGoalie(0)}
                  onToggleDesignation={() => toggleDesignation("goalie", 0, undefined, 0)}
                  onDragStart={(e) => handleDragStart(e, { type: "goalie", goalieIndex: 0 })}
                  onDrop={(e) => handleDrop(e, { type: "goalie", goalieIndex: 0 })}
                  onDragOver={handleDragOver}
                />
              </div>
            </>
          );
        })()}
      </div>

      {/* Second goalie (edit mode: always show; read-only: only if filled) */}
      {(readOnly ? hasSecondGoalie : goalieSlots.length > 1) && (
        <div className="flex justify-center mb-6">
          <PositionSlot
            slotPosition="GK"
            label={`${t("gk")} 2`}
            assignment={goalieSlots[1]}
            player={getPlayer(goalieSlots[1]?.playerId)}
            availablePlayers={sortedPlayersForSlot("GK")}
            positionTranslations={tp}
            gameTranslations={t}
            readOnly={readOnly}
            onAssign={(pid) => assignGoalie(1, pid)}
            onClear={() => clearGoalie(1)}
            onToggleDesignation={() => toggleDesignation("goalie", 0, undefined, 1)}
            onDragStart={(e) => handleDragStart(e, { type: "goalie", goalieIndex: 1 })}
            onDrop={(e) => handleDrop(e, { type: "goalie", goalieIndex: 1 })}
            onDragOver={handleDragOver}
          />
        </div>
      )}

      {/* Available Players Pool (edit mode only) */}
      {!readOnly && availablePlayers.length > 0 && (
        <Card className="border-border/40 mb-6">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base">
              {t("otherPlayers")} ({availablePlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {availablePlayers.map((player) => (
                <div
                  key={player.id}
                  draggable
                  onDragStart={(e) =>
                    handleDragStart(e, {
                      type: "available",
                      playerId: player.id,
                    })
                  }
                  className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-secondary/50 border border-border/30 cursor-grab active:cursor-grabbing hover:bg-secondary/80 transition-colors"
                >
                  <span className="text-primary font-bold text-xs">
                    #{player.jersey_number ?? "-"}
                  </span>
                  <span className="text-xs font-medium">
                    {player.nickname || player.last_name || player.first_name}
                  </span>
                  <Badge
                    variant="secondary"
                    className={`text-[9px] px-1.5 py-0 ${POSITION_COLORS[player.position as PlayerPosition]}`}
                  >
                    {tp(player.position)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-save indicator (edit mode only) */}
      {!readOnly && autoSaveStatus !== "idle" && (
        <div className="flex justify-center">
          {autoSaveStatus === "saving" && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {tc("saving")}
            </span>
          )}
          {autoSaveStatus === "saved" && (
            <span className="text-xs text-green-400 flex items-center gap-1.5 py-2">
              <Check className="h-3 w-3" />
              {tc("autoSaved")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Position Slot Component =====

interface PositionSlotProps {
  slotPosition: SlotPosition;
  label: string;
  assignment: SlotAssignment;
  player: Profile | undefined;
  availablePlayers: Profile[];
  positionTranslations: ReturnType<typeof useTranslations>;
  gameTranslations: ReturnType<typeof useTranslations>;
  readOnly?: boolean;
  onAssign: (playerId: string) => void;
  onClear: () => void;
  onToggleDesignation: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}

function PositionSlot({
  slotPosition,
  label,
  assignment,
  player,
  availablePlayers,
  positionTranslations: tp,
  gameTranslations: t,
  readOnly = false,
  onAssign,
  onClear,
  onToggleDesignation,
  onDragStart,
  onDrop,
  onDragOver,
}: PositionSlotProps) {
  const [open, setOpen] = useState(false);
  const color = POSITION_COLORS_HEX[SLOT_TO_POSITION[slotPosition]];
  const isEmpty = !assignment.playerId;

  // Split available players: position matches first
  const targetPosition = SLOT_TO_POSITION[slotPosition];
  const matchingPlayers = availablePlayers.filter((p) => p.position === targetPosition);
  const otherPlayersList = availablePlayers.filter((p) => p.position !== targetPosition);

  const displayName = player
    ? (player.nickname || player.last_name || player.first_name || "")
    : "";

  const nameLabel = (
    <div className="text-center">
      {!isEmpty && player ? (
        <p className="inline-block px-3 py-1 rounded-full bg-team-navy/80 text-[11px] sm:text-xs font-semibold text-white whitespace-nowrap">
          #{player.jersey_number ?? ""} {displayName}
        </p>
      ) : (
        <p className="text-[10px] font-medium text-team-navy/50">{label}</p>
      )}
    </div>
  );

  // Player circle content (shared between readOnly and edit modes)
  const playerCircle = (
    <div
      className={`relative w-18 h-18 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center transition-all ${
        isEmpty
          ? readOnly
            ? "border-2 border-dashed border-team-navy/20 bg-white/40"
            : "border-2 border-dashed border-team-navy/30 bg-white/60 hover:border-primary/50 hover:bg-white/80 cursor-pointer"
          : readOnly
            ? "border-[3px] border-solid"
            : "border-[3px] border-solid hover:scale-105 active:cursor-grabbing cursor-pointer"
      }`}
      style={
        isEmpty
          ? undefined
          : {
              borderColor: color,
              backgroundColor: `${color}10`,
            }
      }
    >
      {isEmpty ? (
        <>
          <span
            className="text-lg font-bold"
            style={{ color }}
          >
            {label}
          </span>
          {!readOnly && (
            <span className="text-[9px] text-team-navy/50 mt-0.5">
              {t("emptySlot")}
            </span>
          )}
        </>
      ) : (
        <>
          {/* Designation badge */}
          {assignment.designation !== "player" && (
            <div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white z-10"
              style={{ backgroundColor: "#e8732a" }}
              onClick={readOnly ? undefined : (e) => {
                e.stopPropagation();
                onToggleDesignation();
              }}
            >
              {assignment.designation === "captain" ? "C" : "A"}
            </div>
          )}
          {/* Player avatar or initials */}
          {player?.avatar_url ? (
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={player.avatar_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white text-sm sm:text-base font-bold"
              style={{ backgroundColor: color }}
            >
              {player
                ? (player.nickname?.[0] ?? player.last_name?.[0] ?? player.first_name?.[0] ?? "?")
                : "?"}
            </div>
          )}
        </>
      )}
    </div>
  );

  // Read-only mode: no Popover, no drag
  if (readOnly) {
    return (
      <div className="flex flex-col items-center gap-1 w-32">
        {playerCircle}
        {nameLabel}
      </div>
    );
  }

  // Edit mode: full Popover + drag & drop
  return (
    <div className="flex flex-col items-center gap-1 w-32">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            draggable={!isEmpty}
            onDragStart={isEmpty ? undefined : onDragStart}
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            {playerCircle}
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="w-56 p-0 max-h-72 overflow-y-auto"
          align="center"
          side="bottom"
        >
          {/* Clear button if assigned */}
          {!isEmpty && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 border-b border-border/30"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
              {t("clearSlot")}
            </button>
          )}

          {/* Designation toggle if assigned */}
          {!isEmpty && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent border-b border-border/30"
              onClick={() => {
                onToggleDesignation();
              }}
            >
              <Badge variant="secondary" className="text-[9px]">
                {assignment.designation === "player"
                  ? "-"
                  : assignment.designation === "captain"
                    ? "C"
                    : "A"}
              </Badge>
              C / A / -
            </button>
          )}

          {/* Matching position players */}
          {matchingPlayers.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-secondary/30">
                {t("positionMatch")}
              </div>
              {matchingPlayers.map((p) => (
                <PlayerPickerItem
                  key={p.id}
                  player={p}
                  tp={tp}
                  highlight
                  onClick={() => {
                    onAssign(p.id);
                    setOpen(false);
                  }}
                />
              ))}
            </>
          )}

          {/* Other players */}
          {otherPlayersList.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-secondary/30">
                {t("otherPlayers")}
              </div>
              {otherPlayersList.map((p) => (
                <PlayerPickerItem
                  key={p.id}
                  player={p}
                  tp={tp}
                  highlight={false}
                  onClick={() => {
                    onAssign(p.id);
                    setOpen(false);
                  }}
                />
              ))}
            </>
          )}

          {availablePlayers.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Svi igraci su rasporedjeni
            </div>
          )}
        </PopoverContent>
      </Popover>

      {nameLabel}
    </div>
  );
}

// ===== Player Picker Item =====

function PlayerPickerItem({
  player,
  tp,
  highlight,
  onClick,
}: {
  player: Profile;
  tp: ReturnType<typeof useTranslations>;
  highlight: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors ${
        highlight ? "bg-primary/5" : ""
      }`}
      onClick={onClick}
    >
      <span className="text-primary font-bold text-xs min-w-6">
        #{player.jersey_number ?? "-"}
      </span>
      <span className="flex-1 text-left truncate text-xs">
        {player.nickname || player.last_name || player.first_name}
      </span>
      <Badge
        variant="secondary"
        className={`text-[9px] px-1 py-0 ${POSITION_COLORS[player.position as PlayerPosition]}`}
      >
        {tp(player.position)}
      </Badge>
    </button>
  );
}
