"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
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

  // Track which assist fields are expanded per goal row (mobile progressive reveal)
  const [expandedAssists, setExpandedAssists] = useState<
    Map<number, { assist1: boolean; assist2: boolean }>
  >(new Map());

  // Auto-expand assists that already have values
  useEffect(() => {
    setExpandedAssists((prev) => {
      const next = new Map(prev);
      for (let i = 0; i < teamGoals; i++) {
        const event = goalEvents[i];
        if (!event) continue;
        const current = next.get(i) ?? { assist1: false, assist2: false };
        if (event.assist_1_player_id && !current.assist1) {
          next.set(i, { ...current, assist1: true });
        }
        if (event.assist_2_player_id) {
          next.set(i, { assist1: true, assist2: true });
        }
      }
      return next;
    });
  }, [goalEvents, teamGoals]);

  const updateGoalEvent = useCallback(
    (index: number, field: keyof GoalEventInput, value: string) => {
      // Ensure the array is at least as long as the index we're updating
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

  function toggleAssist(index: number, which: "assist1" | "assist2", show: boolean) {
    setExpandedAssists((prev) => {
      const next = new Map(prev);
      const current = next.get(index) ?? { assist1: false, assist2: false };
      next.set(index, { ...current, [which]: show });
      return next;
    });

    // Clear assist value when hiding
    if (!show) {
      if (which === "assist1") {
        updateGoalEvent(index, "assist_1_player_id", "");
        // Also hide and clear assist 2 when assist 1 is hidden
        setExpandedAssists((prev) => {
          const n = new Map(prev);
          const c = n.get(index) ?? { assist1: false, assist2: false };
          n.set(index, { ...c, assist1: false, assist2: false });
          return n;
        });
        updateGoalEvent(index, "assist_2_player_id", "");
      } else {
        updateGoalEvent(index, "assist_2_player_id", "");
      }
    }
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
      <div className="space-y-3">
        {Array.from({ length: teamGoals }).map((_, index) => {
          const event = goalEvents[index] ?? createEmptyGoalEvent();
          const assists = expandedAssists.get(index) ?? { assist1: false, assist2: false };
          const showAssist1 = assists.assist1;
          const showAssist2 = assists.assist2;

          return (
            <div
              key={`goal-event-${index}`}
              className="rounded-md border border-border/40 p-3"
            >
              <Label className="text-xs text-muted-foreground mb-2 block">
                {tg("goalLabel")} #{index + 1}
              </Label>

              {/* Desktop: row of 3 selects. Mobile: progressive */}
              <div className="flex flex-col md:flex-row md:items-center gap-2">
                {/* Scorer select */}
                <div className="flex-1 min-w-0">
                  <Select
                    value={event.scorer_player_id || "__none__"}
                    onValueChange={(value) =>
                      updateGoalEvent(index, "scorer_player_id", value === "__none__" ? "" : value)
                    }
                  >
                    <SelectTrigger className="bg-background h-9">
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

                {/* Assist 1: always visible on desktop, progressive on mobile */}
                <div className={`flex-1 min-w-0 ${showAssist1 ? "" : "hidden md:block"}`}>
                  <Select
                    value={event.assist_1_player_id || "__none__"}
                    onValueChange={(value) =>
                      updateGoalEvent(index, "assist_1_player_id", value === "__none__" ? "" : value)
                    }
                  >
                    <SelectTrigger className="bg-background h-9">
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

                {/* Assist 2: always visible on desktop, progressive on mobile */}
                <div className={`flex-1 min-w-0 ${showAssist2 ? "" : "hidden md:block"}`}>
                  <Select
                    value={event.assist_2_player_id || "__none__"}
                    onValueChange={(value) =>
                      updateGoalEvent(index, "assist_2_player_id", value === "__none__" ? "" : value)
                    }
                  >
                    <SelectTrigger className="bg-background h-9">
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

                {/* Mobile + / × buttons */}
                <div className="flex items-center gap-1 md:hidden">
                  {!showAssist1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs"
                      onClick={() => toggleAssist(index, "assist1", true)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {tg("addAssist")}
                    </Button>
                  )}
                  {showAssist1 && !showAssist2 && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={() => toggleAssist(index, "assist2", true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        A2
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => toggleAssist(index, "assist1", false)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {showAssist2 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => toggleAssist(index, "assist2", false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
