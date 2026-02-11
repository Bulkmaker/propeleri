"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Loader2, Save, CheckCircle, XCircle, Wand2 } from "lucide-react";
import type {
  Profile,
  TrainingGoalEvent,
  TrainingMatchData,
  TrainingSession,
  TrainingStats,
  TrainingTeam,
} from "@/types/database";
import { formatPlayerName, formatPlayerNameWithNumber } from "@/lib/utils/player-name";

const NONE_OPTION = "__none__";

interface TrainingRow {
  player_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  jersey_number: number | null;
  default_training_team: TrainingTeam | null;
  attended: boolean;
  is_guest: boolean;
  goals: number;
  assists: number;
  training_team: TrainingTeam | null;
}

interface GoalEventForm {
  team: TrainingTeam;
  scorer_player_id: string;
  assist_player_id: string;
}

function parseTrainingMatchData(raw: unknown): TrainingMatchData | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<TrainingMatchData>;
  const events = Array.isArray(value.goal_events)
    ? value.goal_events
        .map((event) => {
          if (!event || typeof event !== "object") return null;
          const eventValue = event as Partial<TrainingGoalEvent>;
          if (eventValue.team !== "team_a" && eventValue.team !== "team_b") return null;
          if (typeof eventValue.scorer_player_id !== "string") return null;
          return {
            team: eventValue.team,
            scorer_player_id: eventValue.scorer_player_id,
            assist_player_id:
              typeof eventValue.assist_player_id === "string"
                ? eventValue.assist_player_id
                : null,
          } satisfies TrainingGoalEvent;
        })
        .filter((event): event is TrainingGoalEvent => Boolean(event))
    : [];

  return {
    version: 1,
    team_a_score:
      typeof value.team_a_score === "number" && value.team_a_score >= 0
        ? value.team_a_score
        : 0,
    team_b_score:
      typeof value.team_b_score === "number" && value.team_b_score >= 0
        ? value.team_b_score
        : 0,
    team_a_goalie_player_id:
      typeof value.team_a_goalie_player_id === "string"
        ? value.team_a_goalie_player_id
        : null,
    team_b_goalie_player_id:
      typeof value.team_b_goalie_player_id === "string"
        ? value.team_b_goalie_player_id
        : null,
    goal_events: events,
  };
}

function createEmptyGoalEvent(team: TrainingTeam): GoalEventForm {
  return {
    team,
    scorer_player_id: "",
    assist_player_id: "",
  };
}

function normalizeGoalEventsCount(
  events: GoalEventForm[],
  teamAScore: number,
  teamBScore: number
) {
  const targetCount = Math.max(0, teamAScore) + Math.max(0, teamBScore);
  const next = events.slice(0, targetCount);
  while (next.length < targetCount) {
    next.push(createEmptyGoalEvent(next.length < teamAScore ? "team_a" : "team_b"));
  }
  return next;
}

function buildAutosaveSnapshot(
  rows: TrainingRow[],
  matchScoreA: number,
  matchScoreB: number,
  teamAGoalieId: string,
  teamBGoalieId: string,
  goalEvents: GoalEventForm[]
) {
  return JSON.stringify({
    rows: [...rows]
      .map((row) => ({
        player_id: row.player_id,
        attended: row.attended,
        goals: row.goals,
        assists: row.assists,
        training_team: row.training_team,
      }))
      .sort((a, b) => a.player_id.localeCompare(b.player_id)),
    match: {
      team_a_score: matchScoreA,
      team_b_score: matchScoreB,
      team_a_goalie_player_id: teamAGoalieId,
      team_b_goalie_player_id: teamBGoalieId,
      goal_events: goalEvents.map((event) => ({
        team: event.team,
        scorer_player_id: event.scorer_player_id,
        assist_player_id: event.assist_player_id,
      })),
    },
  });
}

export default function TrainingStatsEntryPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const tc = useTranslations("common");
  const ts = useTranslations("stats");
  const tt = useTranslations("training");

  const [rows, setRows] = useState<TrainingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  const [matchScoreA, setMatchScoreA] = useState(0);
  const [matchScoreB, setMatchScoreB] = useState(0);
  const [teamAGoalieId, setTeamAGoalieId] = useState("");
  const [teamBGoalieId, setTeamBGoalieId] = useState("");
  const [goalEvents, setGoalEvents] = useState<GoalEventForm[]>([]);

  const supabase = useMemo(() => createClient(), []);
  const isInitializedRef = useRef(false);
  const savingRef = useRef(false);
  const lastSavedSnapshotRef = useRef("");

  useEffect(() => {
    async function load() {
      const [{ data: sessionData }, { data: players }, { data: existing }] =
        await Promise.all([
          supabase.from("training_sessions").select("*").eq("id", sessionId).single(),
          supabase
            .from("profiles")
            .select("*")
            .eq("is_active", true)
            .eq("is_approved", true)
            .order("jersey_number"),
          supabase.from("training_stats").select("*").eq("session_id", sessionId),
        ]);

      const statsMap = new Map((existing ?? []).map((s: TrainingStats) => [s.player_id, s]));

      const playerRows: TrainingRow[] = (players ?? []).map((p: Profile) => {
        const e = statsMap.get(p.id);
        return {
          player_id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          nickname: p.nickname,
          jersey_number: p.jersey_number,
          default_training_team: p.default_training_team,
          attended: e?.attended ?? false,
          is_guest: p.is_guest ?? false,
          goals: e?.goals ?? 0,
          assists: e?.assists ?? 0,
          training_team: e?.training_team ?? null,
        };
      });

      setRows(playerRows);

      const loadedSession = (sessionData ?? null) as TrainingSession | null;
      setSession(loadedSession);

      const parsedMatch = parseTrainingMatchData(loadedSession?.match_data);
      if (parsedMatch) {
        setMatchScoreA(parsedMatch.team_a_score);
        setMatchScoreB(parsedMatch.team_b_score);
        setTeamAGoalieId(parsedMatch.team_a_goalie_player_id ?? "");
        setTeamBGoalieId(parsedMatch.team_b_goalie_player_id ?? "");
        setGoalEvents(
          normalizeGoalEventsCount(
            parsedMatch.goal_events.map((event) => ({
              team: event.team,
              scorer_player_id: event.scorer_player_id,
              assist_player_id: event.assist_player_id ?? "",
            })),
            parsedMatch.team_a_score,
            parsedMatch.team_b_score
          )
        );
      } else {
        const teamAGoals = playerRows
          .filter((row) => row.attended && row.training_team === "team_a")
          .reduce((acc, row) => acc + row.goals, 0);
        const teamBGoals = playerRows
          .filter((row) => row.attended && row.training_team === "team_b")
          .reduce((acc, row) => acc + row.goals, 0);
        setMatchScoreA(teamAGoals);
        setMatchScoreB(teamBGoals);
        setGoalEvents(normalizeGoalEventsCount([], teamAGoals, teamBGoals));
      }

      setLoading(false);
    }
    void load();
  }, [sessionId, supabase]);

  function setMatchScores(teamAScore: number, teamBScore: number) {
    const nextA = Math.max(0, teamAScore);
    const nextB = Math.max(0, teamBScore);
    setMatchScoreA(nextA);
    setMatchScoreB(nextB);
    setGoalEvents((prev) => normalizeGoalEventsCount(prev, nextA, nextB));
  }

  function toggleAttendance(playerId: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.player_id !== playerId) return row;
        const nextAttended = !row.attended;
        return {
          ...row,
          attended: nextAttended,
          training_team: nextAttended
            ? row.training_team ?? row.default_training_team ?? null
            : row.training_team,
        };
      })
    );
  }

  function updateRow(
    playerId: string,
    field: "goals" | "assists",
    value: number
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.player_id === playerId ? { ...row, [field]: value } : row
      )
    );
  }

  function setTeam(playerId: string, team: TrainingTeam | null) {
    setRows((prev) =>
      prev.map((row) =>
        row.player_id === playerId ? { ...row, training_team: team } : row
      )
    );
  }

  function autoAssignTeams() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        training_team: row.default_training_team,
      }))
    );
  }

  const attendedTeamA = useMemo(
    () =>
      rows
        .filter((row) => row.attended && row.training_team === "team_a")
        .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999)),
    [rows]
  );
  const attendedTeamB = useMemo(
    () =>
      rows
        .filter((row) => row.attended && row.training_team === "team_b")
        .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999)),
    [rows]
  );

  const teamRowsA = useMemo(
    () =>
      rows
        .filter((row) => row.training_team === "team_a")
        .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999)),
    [rows]
  );
  const teamRowsB = useMemo(
    () =>
      rows
        .filter((row) => row.training_team === "team_b")
        .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999)),
    [rows]
  );
  const unassignedRows = useMemo(
    () =>
      rows
        .filter((row) => !row.training_team)
        .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999)),
    [rows]
  );

  function getPlayersByTeam(team: TrainingTeam) {
    return team === "team_a" ? attendedTeamA : attendedTeamB;
  }

  function updateGoalEvent(
    idx: number,
    field: "team" | "scorer_player_id" | "assist_player_id",
    value: string
  ) {
    setGoalEvents((prev) =>
      prev.map((event, eventIdx) => {
        if (eventIdx !== idx) return event;

        const next = { ...event };
        if (field === "team") {
          const nextTeam = value === "team_b" ? "team_b" : "team_a";
          next.team = nextTeam;
          const teamPlayerIds = new Set(getPlayersByTeam(nextTeam).map((player) => player.player_id));
          if (!teamPlayerIds.has(next.scorer_player_id)) next.scorer_player_id = "";
          if (!teamPlayerIds.has(next.assist_player_id)) next.assist_player_id = "";
          return next;
        }

        if (field === "scorer_player_id") {
          next.scorer_player_id = value;
          if (next.assist_player_id === value) next.assist_player_id = "";
          return next;
        }

        next.assist_player_id = value;
        if (next.assist_player_id === next.scorer_player_id) next.assist_player_id = "";
        return next;
      })
    );
  }

  const autosaveSnapshot = useMemo(
    () =>
      buildAutosaveSnapshot(
        rows,
        matchScoreA,
        matchScoreB,
        teamAGoalieId,
        teamBGoalieId,
        goalEvents
      ),
    [goalEvents, matchScoreA, matchScoreB, rows, teamAGoalieId, teamBGoalieId]
  );

  const persistChanges = useCallback(async (showMessage: boolean) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setError("");
    if (showMessage) setMessage("");

    const structuredMode = matchScoreA + matchScoreB > 0;
    const goalsByPlayer = new Map<string, number>();
    const assistsByPlayer = new Map<string, number>();
    const normalizedGoalEvents: TrainingGoalEvent[] = [];

    if (structuredMode) {
      for (const event of goalEvents) {
        const teamPlayers = event.team === "team_a" ? attendedTeamA : attendedTeamB;
        const teamPlayerIds = new Set(teamPlayers.map((player) => player.player_id));

        if (!event.scorer_player_id) {
          continue;
        }

        if (!teamPlayerIds.has(event.scorer_player_id)) {
          setError(tt("errorScorerTeam"));
          setSaving(false);
          savingRef.current = false;
          return false;
        }

        if (
          event.assist_player_id &&
          (!teamPlayerIds.has(event.assist_player_id) ||
            event.assist_player_id === event.scorer_player_id)
        ) {
          setError(tt("errorAssistTeam"));
          setSaving(false);
          savingRef.current = false;
          return false;
        }

        goalsByPlayer.set(
          event.scorer_player_id,
          (goalsByPlayer.get(event.scorer_player_id) ?? 0) + 1
        );

        if (event.assist_player_id) {
          assistsByPlayer.set(
            event.assist_player_id,
            (assistsByPlayer.get(event.assist_player_id) ?? 0) + 1
          );
        }

        normalizedGoalEvents.push({
          team: event.team,
          scorer_player_id: event.scorer_player_id,
          assist_player_id: event.assist_player_id || null,
        });
      }
    }

    const rowsToUpsert = rows.map((row) => ({
      session_id: sessionId,
      player_id: row.player_id,
      attended: row.attended,
      is_guest: row.attended ? row.is_guest : false,
      training_team: row.training_team,
      goals: structuredMode ? goalsByPlayer.get(row.player_id) ?? 0 : row.goals,
      assists: structuredMode ? assistsByPlayer.get(row.player_id) ?? 0 : row.assists,
    }));

    const statsRes = await supabase
      .from("training_stats")
      .upsert(rowsToUpsert, { onConflict: "session_id,player_id" });

    if (statsRes.error) {
      setError(statsRes.error.message);
      setSaving(false);
      savingRef.current = false;
      return false;
    }

    const hasMatchData =
      structuredMode ||
      Boolean(teamAGoalieId) ||
      Boolean(teamBGoalieId) ||
      matchScoreA > 0 ||
      matchScoreB > 0;

    const matchData: TrainingMatchData | null = hasMatchData
      ? {
          version: 1,
          team_a_score: matchScoreA,
          team_b_score: matchScoreB,
          team_a_goalie_player_id: teamAGoalieId || null,
          team_b_goalie_player_id: teamBGoalieId || null,
          goal_events: normalizedGoalEvents,
        }
      : null;

    const sessionRes = await supabase
      .from("training_sessions")
      .update({ match_data: matchData })
      .eq("id", sessionId);

    if (sessionRes.error) {
      setError(sessionRes.error.message);
      setSaving(false);
      savingRef.current = false;
      return false;
    }

    setSession((prev) => (prev ? { ...prev, match_data: matchData } : prev));
    if (showMessage) {
      setMessage(tt("statsSaved"));
    }
    setSaving(false);
    savingRef.current = false;
    return true;
  }, [
    attendedTeamA,
    attendedTeamB,
    goalEvents,
    matchScoreA,
    matchScoreB,
    rows,
    sessionId,
    supabase,
    teamAGoalieId,
    teamBGoalieId,
    tt,
  ]);

  async function handleSave() {
    const ok = await persistChanges(true);
    if (ok) {
      lastSavedSnapshotRef.current = autosaveSnapshot;
      setAutosaveStatus("saved");
    }
  }

  useEffect(() => {
    if (loading) return;

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      lastSavedSnapshotRef.current = autosaveSnapshot;
      return;
    }

    if (autosaveSnapshot === lastSavedSnapshotRef.current) return;

    const timer = window.setTimeout(async () => {
      setAutosaveStatus("saving");
      const ok = await persistChanges(false);
      if (ok) {
        lastSavedSnapshotRef.current = autosaveSnapshot;
        setAutosaveStatus("saved");
      } else {
        setAutosaveStatus("error");
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [autosaveSnapshot, loading, persistChanges]);

  function renderPlayerRow(row: TrainingRow) {
    const structuredMode = matchScoreA + matchScoreB > 0;

    return (
      <div
        key={row.player_id}
        className="rounded-md border border-border/50 bg-secondary/20 p-2.5 flex items-center gap-2"
      >
        <span className="w-8 text-xs text-primary font-bold text-center">
          {row.jersey_number ?? "-"}
        </span>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => toggleAttendance(row.player_id)}
          className={`h-7 w-7 p-0 shrink-0 ${
            row.attended ? "text-green-400 hover:text-green-300" : "text-red-400 hover:text-red-300"
          }`}
          aria-label={tt("attendance")}
        >
          {row.attended ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        </Button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {formatPlayerName(row)}
          </p>
          <div className="flex items-center gap-2">
            {row.is_guest && (
              <span className="text-[10px] rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-400">
                {tt("guest")}
              </span>
            )}
            {!row.attended && (
              <span className="text-[10px] text-muted-foreground">{tt("absent")}</span>
            )}
          </div>
        </div>

        <Input
          type="number"
          min={0}
          value={row.goals}
          onChange={(e) => updateRow(row.player_id, "goals", parseInt(e.target.value) || 0)}
          className="w-12 h-7 text-center bg-background"
          disabled={!row.attended || structuredMode}
        />

        <Input
          type="number"
          min={0}
          value={row.assists}
          onChange={(e) => updateRow(row.player_id, "assists", parseInt(e.target.value) || 0)}
          className="w-12 h-7 text-center bg-background"
          disabled={!row.attended || structuredMode}
        />

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={row.training_team === "team_a" ? "default" : "ghost"}
            className={`h-7 w-7 p-0 text-xs font-bold ${
              row.training_team === "team_a"
                ? "bg-white text-black hover:bg-white/90"
                : "text-muted-foreground"
            }`}
            onClick={() => setTeam(row.player_id, row.training_team === "team_a" ? null : "team_a")}
          >
            A
          </Button>
          <Button
            size="sm"
            variant={row.training_team === "team_b" ? "default" : "ghost"}
            className={`h-7 w-7 p-0 text-xs font-bold ${
              row.training_team === "team_b"
                ? "bg-gray-700 text-white hover:bg-gray-600"
                : "text-muted-foreground"
            }`}
            onClick={() => setTeam(row.player_id, row.training_team === "team_b" ? null : "team_b")}
          >
            B
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-6 py-4">
        <Link
          href="/admin/training"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {tc("back")}
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {session?.title || tt("session")} · {tt("attendance")} & {ts("title")}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground min-w-[130px] text-right">
              {autosaveStatus === "saving"
                ? tt("autosaveSaving")
                : autosaveStatus === "saved"
                  ? tt("autosaveSaved")
                  : autosaveStatus === "error"
                    ? tt("autosaveError")
                    : ""}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={autoAssignTeams}
              className="border-primary/30 text-primary"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              {tt("autoAssign")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-primary"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {tc("save")}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle>{tt("trainingMatch")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{tt("teamA")}</p>
                <Input
                  type="number"
                  min={0}
                  value={matchScoreA}
                  onChange={(e) =>
                    setMatchScores(Number(e.target.value) || 0, matchScoreB)
                  }
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{tt("teamB")}</p>
                <Input
                  type="number"
                  min={0}
                  value={matchScoreB}
                  onChange={(e) =>
                    setMatchScores(matchScoreA, Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{tt("goalieTeamA")}</p>
                <Select
                  value={teamAGoalieId || NONE_OPTION}
                  onValueChange={(value) => setTeamAGoalieId(value === NONE_OPTION ? "" : value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_OPTION}>-</SelectItem>
                    {attendedTeamA.map((player) => (
                      <SelectItem key={player.player_id} value={player.player_id}>
                        {formatPlayerNameWithNumber(player)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{tt("goalieTeamB")}</p>
                <Select
                  value={teamBGoalieId || NONE_OPTION}
                  onValueChange={(value) => setTeamBGoalieId(value === NONE_OPTION ? "" : value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_OPTION}>-</SelectItem>
                    {attendedTeamB.map((player) => (
                      <SelectItem key={player.player_id} value={player.player_id}>
                        {formatPlayerNameWithNumber(player)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {goalEvents.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{tt("goalsTimeline")}</p>
                <p className="text-xs text-muted-foreground">{tt("goalsOptional")}</p>
                <div className="space-y-2">
                  {goalEvents.map((event, idx) => {
                    const players = getPlayersByTeam(event.team);
                    return (
                      <div key={`${event.team}-${idx}`} className="grid gap-2 md:grid-cols-4">
                        <Select
                          value={event.team}
                          onValueChange={(value) => updateGoalEvent(idx, "team", value)}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="team_a">{tt("teamA")}</SelectItem>
                            <SelectItem value="team_b">{tt("teamB")}</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={event.scorer_player_id || NONE_OPTION}
                          onValueChange={(value) =>
                            updateGoalEvent(
                              idx,
                              "scorer_player_id",
                              value === NONE_OPTION ? "" : value
                            )
                          }
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder={tt("goalScorer")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_OPTION}>-</SelectItem>
                            {players.map((player) => (
                              <SelectItem key={player.player_id} value={player.player_id}>
                                {formatPlayerNameWithNumber(player)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={event.assist_player_id || NONE_OPTION}
                          onValueChange={(value) =>
                            updateGoalEvent(
                              idx,
                              "assist_player_id",
                              value === NONE_OPTION ? "" : value
                            )
                          }
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder={tt("assist")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_OPTION}>-</SelectItem>
                            {players
                              .filter((player) => player.player_id !== event.scorer_player_id)
                              .map((player) => (
                                <SelectItem key={player.player_id} value={player.player_id}>
                                  {formatPlayerNameWithNumber(player)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center text-sm text-muted-foreground px-2">
                          {tt("goal")} #{idx + 1}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tt("setScoreFirst")}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {tt("teams")} · {tt("attendance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-white border border-border" />
                  {tt("teamA")}
                  <span className="text-xs text-muted-foreground">({teamRowsA.length})</span>
                </p>
                {teamRowsA.length > 0 ? (
                  <div className="space-y-2">
                    {teamRowsA.map((row) => renderPlayerRow(row))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{tc("noData")}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-gray-600" />
                  {tt("teamB")}
                  <span className="text-xs text-muted-foreground">({teamRowsB.length})</span>
                </p>
                {teamRowsB.length > 0 ? (
                  <div className="space-y-2">
                    {teamRowsB.map((row) => renderPlayerRow(row))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{tc("noData")}</p>
                )}
              </div>
            </div>

            {unassignedRows.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  {tt("noTeam")} ({unassignedRows.length})
                </p>
                <div className="space-y-2">
                  {unassignedRows.map((row) => renderPlayerRow(row))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mt-4">
                {error}
              </p>
            )}

            {message && (
              <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2 mt-4">
                {message}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-4">{tt("autosaveHint")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
