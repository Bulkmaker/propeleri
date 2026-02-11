"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Loader2, Save, Plus, Trash2, X } from "lucide-react";
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

export default function LineupPage() {
  const params = useParams();
  const gameId = params.gameId as string;
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Drag state
  const [dragSource, setDragSource] = useState<{
    type: "goalie" | "line" | "available";
    lineIndex?: number;
    slot?: string;
    goalieIndex?: number;
    playerId?: string;
  } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      const [playersRes, lineupRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("is_active", true)
          .eq("is_approved", true)
          .order("jersey_number"),
        supabase
          .from("game_lineups")
          .select("*, player:profiles(*)")
          .eq("game_id", gameId)
          .order("line_number")
          .order("slot_position"),
      ]);

      setPlayers(playersRes.data ?? []);

      const entries = (lineupRes.data ?? []) as SavedLineupEntry[];
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
    }
    load();
  }, [gameId, supabase]);

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
    // Store the player ID for reference
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

    // First, remove from source
    if (dragSource.type === "goalie" && dragSource.goalieIndex !== undefined) {
      // Get the player currently in target for swap
      let targetPlayerId: string | null = null;
      if (target.type === "goalie" && target.goalieIndex !== undefined) {
        targetPlayerId = goalieSlots[target.goalieIndex]?.playerId ?? null;
      } else if (target.type === "line" && target.lineIndex !== undefined && target.slot) {
        targetPlayerId = lines[target.lineIndex]?.slots[target.slot as keyof LineData["slots"]]?.playerId ?? null;
      }
      clearGoalie(dragSource.goalieIndex);
      // If swapping, place target player in source
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
    // available source: nothing to clear

    // Then, assign to target
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

  // Save
  async function handleSave() {
    setSaving(true);
    setMessage("");

    // Delete existing lineup
    await supabase.from("game_lineups").delete().eq("game_id", gameId);

    const entries: {
      game_id: string;
      player_id: string;
      designation: LineupDesignation;
      position_played: PlayerPosition;
      line_number: number;
      slot_position: SlotPosition;
    }[] = [];

    // Goalies
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

    // Lines
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

    if (entries.length > 0) {
      await supabase.from("game_lineups").insert(entries);
    }

    setMessage("Postava sacuvana!");
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalAssigned = assignedPlayerIds().size;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        href={`/games/${gameId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("selectLineup")}</h1>
        <Badge variant="secondary" className="text-sm">
          {totalAssigned} {t("lineup").toLowerCase()}
        </Badge>
      </div>

      {/* Goalies Section */}
      <Card className="border-border/40 mb-4">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: POSITION_COLORS_HEX.goalie }} />
            {t("goalies")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex gap-4 flex-wrap">
            {goalieSlots.map((slot, i) => (
              <PositionSlot
                key={`gk-${i}`}
                slotPosition="GK"
                label={`${t("gk")} ${i + 1}`}
                assignment={slot}
                player={getPlayer(slot.playerId)}
                availablePlayers={sortedPlayersForSlot("GK")}
                positionTranslations={tp}
                gameTranslations={t}
                onAssign={(pid) => assignGoalie(i, pid)}
                onClear={() => clearGoalie(i)}
                onToggleDesignation={() => toggleDesignation("goalie", 0, undefined, i)}
                onDragStart={(e) =>
                  handleDragStart(e, { type: "goalie", goalieIndex: i })
                }
                onDrop={(e) =>
                  handleDrop(e, { type: "goalie", goalieIndex: i })
                }
                onDragOver={handleDragOver}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lines (Petorkas) */}
      {lines.map((line, lineIndex) => (
        <Card key={lineIndex} className="border-border/40 mb-4">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t("line")} {lineIndex + 1}
              </CardTitle>
              {lines.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive h-7 px-2"
                  onClick={() => removeLine(lineIndex)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {t("removeLine")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {/* Forwards row */}
            <div className="flex justify-center gap-4 mb-4">
              {(["LW", "C", "RW"] as const).map((slotKey) => (
                <PositionSlot
                  key={`${lineIndex}-${slotKey}`}
                  slotPosition={slotKey}
                  label={t(SLOT_LABEL_KEYS[slotKey])}
                  assignment={line.slots[slotKey]}
                  player={getPlayer(line.slots[slotKey].playerId)}
                  availablePlayers={sortedPlayersForSlot(slotKey)}
                  positionTranslations={tp}
                  gameTranslations={t}
                  onAssign={(pid) => assignLineSlot(lineIndex, slotKey, pid)}
                  onClear={() => clearLineSlot(lineIndex, slotKey)}
                  onToggleDesignation={() =>
                    toggleDesignation("line", lineIndex, slotKey)
                  }
                  onDragStart={(e) =>
                    handleDragStart(e, {
                      type: "line",
                      lineIndex,
                      slot: slotKey,
                    })
                  }
                  onDrop={(e) =>
                    handleDrop(e, {
                      type: "line",
                      lineIndex,
                      slot: slotKey,
                    })
                  }
                  onDragOver={handleDragOver}
                />
              ))}
            </div>
            {/* Defense row */}
            <div className="flex justify-center gap-4">
              {(["LD", "RD"] as const).map((slotKey) => (
                <PositionSlot
                  key={`${lineIndex}-${slotKey}`}
                  slotPosition={slotKey}
                  label={t(SLOT_LABEL_KEYS[slotKey])}
                  assignment={line.slots[slotKey]}
                  player={getPlayer(line.slots[slotKey].playerId)}
                  availablePlayers={sortedPlayersForSlot(slotKey)}
                  positionTranslations={tp}
                  gameTranslations={t}
                  onAssign={(pid) => assignLineSlot(lineIndex, slotKey, pid)}
                  onClear={() => clearLineSlot(lineIndex, slotKey)}
                  onToggleDesignation={() =>
                    toggleDesignation("line", lineIndex, slotKey)
                  }
                  onDragStart={(e) =>
                    handleDragStart(e, {
                      type: "line",
                      lineIndex,
                      slot: slotKey,
                    })
                  }
                  onDrop={(e) =>
                    handleDrop(e, {
                      type: "line",
                      lineIndex,
                      slot: slotKey,
                    })
                  }
                  onDragOver={handleDragOver}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add line button */}
      <Button
        variant="outline"
        className="w-full mb-6 border-dashed border-border/60 text-muted-foreground hover:text-foreground"
        onClick={addLine}
      >
        <Plus className="h-4 w-4 mr-2" />
        {t("addLine")}
      </Button>

      {/* Available Players Pool */}
      {availablePlayers.length > 0 && (
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
                    {player.first_name?.[0]}. {player.last_name}
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

      {/* Save */}
      {message && (
        <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2 mb-4">
          {message}
        </p>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary"
        size="lg"
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {tc("save")}
      </Button>
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

  return (
    <div className="flex flex-col items-center gap-1 w-28">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            draggable={!isEmpty}
            onDragStart={isEmpty ? undefined : onDragStart}
            onDrop={onDrop}
            onDragOver={onDragOver}
            className={`relative w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer ${
              isEmpty
                ? "border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5"
                : "border-2 border-solid hover:scale-105 active:cursor-grabbing"
            }`}
            style={
              isEmpty
                ? undefined
                : {
                    borderColor: color,
                    backgroundColor: `${color}15`,
                  }
            }
          >
            {isEmpty ? (
              <>
                <span
                  className="text-lg font-bold opacity-40"
                  style={{ color }}
                >
                  {label}
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5">
                  {t("emptySlot")}
                </span>
              </>
            ) : (
              <>
                {/* Designation badge */}
                {assignment.designation !== "player" && (
                  <div
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: "#e8732a" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDesignation();
                    }}
                  >
                    {assignment.designation === "captain" ? "C" : "A"}
                  </div>
                )}
                {/* Player initials */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: color }}
                >
                  {player
                    ? `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`
                    : "?"}
                </div>
                <span className="text-[10px] font-bold text-primary mt-0.5">
                  #{player?.jersey_number ?? ""}
                </span>
              </>
            )}
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

      {/* Player name below circle */}
      <div className="text-center h-8">
        {!isEmpty && player ? (
          <>
            <p className="text-[11px] font-medium leading-tight truncate max-w-28">
              {player.last_name}
            </p>
            <p className="text-[9px] text-muted-foreground">{label}</p>
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
        )}
      </div>
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
        {player.first_name} {player.last_name}
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
