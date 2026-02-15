"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { GripVertical, Plus, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  GoalEventInput,
  GoaliePerformance,
  GoalieReportInput,
  GoalPeriod,
  PenaltyEventInput,
  Profile,
} from "@/types/database";

// ─── helpers ──────────────────────────────────────────────────────────────────

export function createEmptyGoalEvent(): GoalEventInput {
  return {
    scorer_player_id: "",
    assist_1_player_id: "",
    assist_2_player_id: "",
    period: "1" as GoalPeriod,
    goal_time: "",
  };
}

export function normalizeGoalEventsCount(
  events: GoalEventInput[],
  goalsCount: number,
): GoalEventInput[] {
  const target = Math.max(0, goalsCount);
  const next = events.slice(0, target);
  while (next.length < target) {
    next.push(createEmptyGoalEvent());
  }
  return next;
}

export function normalizeGoalClock(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "";
  const normalized = cleaned.replace(/\./g, ":");
  if (!/^\d{1,2}:\d{2}$/.test(normalized)) return "";
  const [minutesRaw, secondsRaw] = normalized.split(":");
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);
  if (Number.isNaN(minutes) || Number.isNaN(seconds) || seconds >= 60) return "";
  return `${minutes}:${secondsRaw}`;
}

export const GOAL_PERIOD_VALUES: GoalPeriod[] = ["1", "2", "3", "OT", "SO"];
export const PENALTY_MINUTE_OPTIONS = [2, 4, 5, 10, 20];

export function createEmptyPenaltyEvent(): PenaltyEventInput {
  return { player_id: "", minutes: 2, period: "1" as GoalPeriod };
}

export function parseGameNotesPayload(
  notes: string | null,
): { goal_events: GoalEventInput[]; penalty_events: PenaltyEventInput[]; goalie_report: GoalieReportInput | null } | null {
  if (!notes) return null;

  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;

    const rawEvents = Array.isArray(parsed.goal_events) ? parsed.goal_events : [];
    const normalizedEvents: GoalEventInput[] = rawEvents.map(
      (event: Record<string, unknown>) => ({
        scorer_player_id:
          typeof event?.scorer_player_id === "string" ? event.scorer_player_id : "",
        assist_1_player_id:
          typeof event?.assist_1_player_id === "string" ? event.assist_1_player_id : "",
        assist_2_player_id:
          typeof event?.assist_2_player_id === "string" ? event.assist_2_player_id : "",
        period:
          typeof event?.period === "string" &&
          GOAL_PERIOD_VALUES.includes(event.period as GoalPeriod)
            ? (event.period as GoalPeriod)
            : "1",
        goal_time:
          typeof event?.goal_time === "string" ? normalizeGoalClock(event.goal_time) : "",
        ...(event?.is_penalty_shot === true ? { is_penalty_shot: true } : {}),
      }),
    );

    const rawPenalties = Array.isArray(parsed.penalty_events) ? parsed.penalty_events : [];
    const normalizedPenalties: PenaltyEventInput[] = rawPenalties.map(
      (event: Record<string, unknown>) => ({
        player_id: typeof event?.player_id === "string" ? event.player_id : "",
        minutes: typeof event?.minutes === "number" ? event.minutes : 2,
        period:
          typeof event?.period === "string" &&
          GOAL_PERIOD_VALUES.includes(event.period as GoalPeriod)
            ? (event.period as GoalPeriod)
            : "1",
      }),
    );

    const rawGoalie = parsed.goalie_report as Record<string, unknown> | null | undefined;
    const goalieReport =
      rawGoalie &&
      typeof rawGoalie === "object" &&
      typeof rawGoalie.goalie_player_id === "string" &&
      ["excellent", "good", "average", "bad"].includes(
        (rawGoalie.performance as string) ?? "",
      )
        ? {
            goalie_player_id: rawGoalie.goalie_player_id as string,
            performance: rawGoalie.performance as GoaliePerformance,
          }
        : null;

    return { goal_events: normalizedEvents, penalty_events: normalizedPenalties, goalie_report: goalieReport };
  } catch {
    return null;
  }
}

export function formatPlayerOption(player: Profile) {
  const number = player.jersey_number != null ? `#${player.jersey_number} ` : "";
  return `${number}${player.first_name} ${player.last_name}`;
}

// ─── component ────────────────────────────────────────────────────────────────

interface GoalEventsEditorProps {
  goalEvents: GoalEventInput[];
  onGoalEventsChange: (events: GoalEventInput[]) => void;
  teamGoals: number;
  availablePlayers: Profile[];
  penaltyEvents: PenaltyEventInput[];
  onPenaltyEventsChange: (events: PenaltyEventInput[]) => void;
  goalieReport: GoalieReportInput;
  onGoalieReportChange: (report: GoalieReportInput) => void;
  goalieOptions: Profile[];
}

export function GoalEventsEditor({
  goalEvents,
  onGoalEventsChange,
  teamGoals,
  availablePlayers,
  penaltyEvents,
  onPenaltyEventsChange,
  goalieReport,
  onGoalieReportChange,
  goalieOptions,
}: GoalEventsEditorProps) {
  const tg = useTranslations("game");
  const tc = useTranslations("common");

  const GOALIE_PERFORMANCE_OPTIONS: { value: GoaliePerformance; label: string }[] = useMemo(
    () => [
      { value: "excellent", label: tg("goaliePerformance.excellent") },
      { value: "good", label: tg("goaliePerformance.good") },
      { value: "average", label: tg("goaliePerformance.average") },
      { value: "bad", label: tg("goaliePerformance.bad") },
    ],
    [tg],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const goalIds = useMemo(
    () => Array.from({ length: teamGoals }, (_, i) => `goal-${i}`),
    [teamGoals],
  );

  const updateGoalEvent = useCallback(
    (index: number, field: keyof GoalEventInput, value: string) => {
      const normalized = normalizeGoalEventsCount(goalEvents, Math.max(goalEvents.length, index + 1));
      const next = normalized.map((event, rowIndex) => {
        if (rowIndex !== index) return event;
        const nextEvent = { ...event, [field]: value };
        if (field === "scorer_player_id" && value) {
          if (nextEvent.assist_1_player_id === value) nextEvent.assist_1_player_id = "";
          if (nextEvent.assist_2_player_id === value) nextEvent.assist_2_player_id = "";
        }
        if (field === "assist_1_player_id" && value && value === nextEvent.assist_2_player_id) {
          nextEvent.assist_2_player_id = "";
        }
        if (field === "assist_2_player_id" && value && value === nextEvent.assist_1_player_id) {
          nextEvent.assist_1_player_id = "";
        }
        return nextEvent;
      });
      onGoalEventsChange(next);
    },
    [goalEvents, onGoalEventsChange],
  );

  function togglePenaltyShot(index: number) {
    const normalized = normalizeGoalEventsCount(goalEvents, Math.max(goalEvents.length, index + 1));
    const next = normalized.map((event, i) => {
      if (i !== index) return event;
      const toggled = !event.is_penalty_shot;
      return {
        ...event,
        is_penalty_shot: toggled || undefined,
        assist_1_player_id: toggled ? "" : event.assist_1_player_id,
        assist_2_player_id: toggled ? "" : event.assist_2_player_id,
      };
    });
    onGoalEventsChange(next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(String(active.id).replace("goal-", ""));
    const newIndex = Number(String(over.id).replace("goal-", ""));
    const normalized = normalizeGoalEventsCount(goalEvents, teamGoals);
    onGoalEventsChange(arrayMove(normalized, oldIndex, newIndex));
  }

  if (teamGoals === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">{tg("setScoreForGoals")}</p>
        <PenaltySection
          penaltyEvents={penaltyEvents}
          onPenaltyEventsChange={onPenaltyEventsChange}
          availablePlayers={availablePlayers}
          tg={tg}
        />
        <GoalieSection
          goalieReport={goalieReport}
          onGoalieReportChange={onGoalieReportChange}
          goalieOptions={goalieOptions}
          tg={tg}
          tc={tc}
          performanceOptions={GOALIE_PERFORMANCE_OPTIONS}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={goalIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {Array.from({ length: teamGoals }).map((_, index) => {
              const event = goalEvents[index] ?? createEmptyGoalEvent();
              return (
                <SortableGoalRow
                  key={goalIds[index]}
                  id={goalIds[index]}
                  index={index}
                  event={event}
                  availablePlayers={availablePlayers}
                  updateGoalEvent={updateGoalEvent}
                  togglePenaltyShot={togglePenaltyShot}
                  tg={tg}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <PenaltySection
        penaltyEvents={penaltyEvents}
        onPenaltyEventsChange={onPenaltyEventsChange}
        availablePlayers={availablePlayers}
        tg={tg}
      />

      <GoalieSection
        goalieReport={goalieReport}
        onGoalieReportChange={onGoalieReportChange}
        goalieOptions={goalieOptions}
        tg={tg}
        tc={tc}
        performanceOptions={GOALIE_PERFORMANCE_OPTIONS}
      />
    </div>
  );
}

// ─── sortable goal row ───────────────────────────────────────────────────────

function SortableGoalRow({
  id,
  index,
  event,
  availablePlayers,
  updateGoalEvent,
  togglePenaltyShot,
  tg,
}: {
  id: string;
  index: number;
  event: GoalEventInput;
  availablePlayers: Profile[];
  updateGoalEvent: (index: number, field: keyof GoalEventInput, value: string) => void;
  togglePenaltyShot: (index: number) => void;
  tg: ReturnType<typeof useTranslations>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isPenaltyShot = Boolean(event.is_penalty_shot);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border px-2 py-1.5 ${
        isPenaltyShot ? "border-amber-500/40 bg-amber-500/5" : "border-border/40"
      } ${isDragging ? "opacity-50 z-50 relative" : ""}`}
    >
      {/* Row 1: drag + # + scorer (+ assists on desktop) + penalty shot btn */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-[11px] text-muted-foreground font-medium shrink-0">
          #{index + 1}
        </span>

        {/* Scorer */}
        <div className="flex-1 min-w-0">
          <Select
            value={event.scorer_player_id || "__none__"}
            onValueChange={(value) =>
              updateGoalEvent(index, "scorer_player_id", value === "__none__" ? "" : value)
            }
          >
            <SelectTrigger className="bg-background h-8 text-sm">
              <SelectValue placeholder={tg("scorerLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{tg("selectPlayer")}</SelectItem>
              {availablePlayers.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  {formatPlayerOption(player)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop-only assists inline */}
        {!isPenaltyShot && (
          <>
            <div className="flex-1 min-w-0 hidden md:block">
              <Select
                value={event.assist_1_player_id || "__none__"}
                onValueChange={(value) =>
                  updateGoalEvent(index, "assist_1_player_id", value === "__none__" ? "" : value)
                }
              >
                <SelectTrigger className="bg-background h-8 text-sm">
                  <SelectValue placeholder={tg("assist1Label")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{tg("noAssist")}</SelectItem>
                  {availablePlayers
                    .filter((p) => p.id !== event.scorer_player_id)
                    .map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {formatPlayerOption(player)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0 hidden md:block">
              <Select
                value={event.assist_2_player_id || "__none__"}
                onValueChange={(value) =>
                  updateGoalEvent(index, "assist_2_player_id", value === "__none__" ? "" : value)
                }
              >
                <SelectTrigger className="bg-background h-8 text-sm">
                  <SelectValue placeholder={tg("assist2Label")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{tg("noAssist")}</SelectItem>
                  {availablePlayers
                    .filter(
                      (p) =>
                        p.id !== event.scorer_player_id &&
                        p.id !== event.assist_1_player_id,
                    )
                    .map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {formatPlayerOption(player)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Penalty shot button — at the end */}
        <Button
          type="button"
          size="sm"
          variant={isPenaltyShot ? "default" : "ghost"}
          className={`h-6 px-1.5 text-[10px] leading-none shrink-0 ${
            isPenaltyShot
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "text-muted-foreground/50 hover:text-muted-foreground"
          }`}
          onClick={() => togglePenaltyShot(index)}
          title={tg("penaltyShot")}
        >
          {tg("penaltyShot")}
        </Button>
      </div>

      {/* Row 2: Mobile-only assists (always shown) */}
      {!isPenaltyShot && (
        <div className="flex items-center gap-1.5 mt-1 md:hidden">
          <div className="flex-1 min-w-0">
            <Select
              value={event.assist_1_player_id || "__none__"}
              onValueChange={(value) =>
                updateGoalEvent(index, "assist_1_player_id", value === "__none__" ? "" : value)
              }
            >
              <SelectTrigger className="bg-background h-8 text-sm">
                <SelectValue placeholder={tg("assist1Label")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{tg("noAssist")}</SelectItem>
                {availablePlayers
                  .filter((p) => p.id !== event.scorer_player_id)
                  .map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {formatPlayerOption(player)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-0">
            <Select
              value={event.assist_2_player_id || "__none__"}
              onValueChange={(value) =>
                updateGoalEvent(index, "assist_2_player_id", value === "__none__" ? "" : value)
              }
            >
              <SelectTrigger className="bg-background h-8 text-sm">
                <SelectValue placeholder={tg("assist2Label")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{tg("noAssist")}</SelectItem>
                {availablePlayers
                  .filter(
                    (p) =>
                      p.id !== event.scorer_player_id &&
                      p.id !== event.assist_1_player_id,
                  )
                  .map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {formatPlayerOption(player)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── penalty section ──────────────────────────────────────────────────────────

function PenaltySection({
  penaltyEvents,
  onPenaltyEventsChange,
  availablePlayers,
  tg,
}: {
  penaltyEvents: PenaltyEventInput[];
  onPenaltyEventsChange: (events: PenaltyEventInput[]) => void;
  availablePlayers: Profile[];
  tg: ReturnType<typeof useTranslations>;
}) {
  function addPenalty() {
    onPenaltyEventsChange([...penaltyEvents, createEmptyPenaltyEvent()]);
  }

  function removePenalty(index: number) {
    onPenaltyEventsChange(penaltyEvents.filter((_, i) => i !== index));
  }

  function updatePenalty(index: number, field: keyof PenaltyEventInput, value: string | number) {
    onPenaltyEventsChange(
      penaltyEvents.map((event, i) =>
        i === index ? { ...event, [field]: value } : event
      )
    );
  }

  return (
    <div className="space-y-2 border-t border-border/40 pt-4">
      <div className="flex items-center justify-between">
        <Label>{tg("penalties")}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          onClick={addPenalty}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {tg("addPenalty")}
        </Button>
      </div>

      {penaltyEvents.length === 0 && (
        <p className="text-xs text-muted-foreground">{tg("noPenalties")}</p>
      )}

      <div className="space-y-2">
        {penaltyEvents.map((event, index) => (
          <div
            key={`penalty-${index}`}
            className="rounded-md border border-border/40 p-3 flex flex-col md:flex-row md:items-center gap-2"
          >
            <div className="flex-1 min-w-0">
              <Select
                value={event.player_id || "__none__"}
                onValueChange={(value) =>
                  updatePenalty(index, "player_id", value === "__none__" ? "" : value)
                }
              >
                <SelectTrigger className="bg-background h-9">
                  <SelectValue placeholder={tg("selectPlayer")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{tg("selectPlayer")}</SelectItem>
                  {availablePlayers.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {formatPlayerOption(player)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-24 shrink-0">
              <Select
                value={String(event.minutes)}
                onValueChange={(value) => updatePenalty(index, "minutes", Number(value))}
              >
                <SelectTrigger className="bg-background h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PENALTY_MINUTE_OPTIONS.map((min) => (
                    <SelectItem key={min} value={String(min)}>
                      {min} {tg("penaltyMinutesShort")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-20 shrink-0">
              <Select
                value={event.period}
                onValueChange={(value) => updatePenalty(index, "period", value)}
              >
                <SelectTrigger className="bg-background h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_PERIOD_VALUES.map((p) => (
                    <SelectItem key={p} value={p}>
                      P{p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removePenalty(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── goalie section ───────────────────────────────────────────────────────────

function GoalieSection({
  goalieReport,
  onGoalieReportChange,
  goalieOptions,
  tg,
  tc,
  performanceOptions,
}: {
  goalieReport: GoalieReportInput;
  onGoalieReportChange: (report: GoalieReportInput) => void;
  goalieOptions: Profile[];
  tg: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
  performanceOptions: { value: GoaliePerformance; label: string }[];
}) {
  return (
    <div className="space-y-2 border-t border-border/40 pt-4">
      <Label>{tg("goalieAndPerformance")}</Label>
      <div className="grid gap-2 md:grid-cols-2">
        <Select
          value={goalieReport.goalie_player_id || "__none__"}
          onValueChange={(value) =>
            onGoalieReportChange({
              ...goalieReport,
              goalie_player_id: value === "__none__" ? "" : value,
            })
          }
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={tg("selectGoalie")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{tc("notSelected")}</SelectItem>
            {goalieOptions.map((player) => (
              <SelectItem key={player.id} value={player.id}>
                {formatPlayerOption(player)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={goalieReport.performance}
          onValueChange={(value) =>
            onGoalieReportChange({
              ...goalieReport,
              performance: value as GoaliePerformance,
            })
          }
        >
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {performanceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
