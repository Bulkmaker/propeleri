"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Loader2, Save, Check, X, Wand2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import type {
  Profile,
  Season,
  TrainingGoalEvent,
  TrainingMatchData,
  TrainingSession,
  TrainingSessionStatus,
  TrainingStats,
  TrainingTeam,
} from "@/types/database";
import { formatPlayerName, formatPlayerNameWithNumber } from "@/lib/utils/player-name";
import {
  belgradeDateTimeLocalInputToUtcIso,
  utcToBelgradeDateTimeLocalInput,
} from "@/lib/utils/datetime";
import { isValidYouTubeUrl } from "@/lib/utils/youtube";
import { SlugField } from "@/components/admin/SlugField";
import { buildTrainingSlug } from "@/lib/utils/match-slug";

// Simple avatar with <img> fallback (bypasses Radix loading check)
function PlayerAvatar({ src, initials, className }: { src: string | null; initials: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full bg-muted ${className ?? "h-9 w-9"}`}>
      {src && !failed ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
          {initials}
        </span>
      )}
    </div>
  );
}

const NONE_OPTION = "__none__";
const SESSION_STATUSES: TrainingSessionStatus[] = ["planned", "completed", "canceled"];

function normalizeStatus(status: string | null | undefined): TrainingSessionStatus {
  if (status === "completed" || status === "canceled") return status;
  return "planned";
}

interface TrainingRow {
  player_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  jersey_number: number | null;
  avatar_url: string | null;
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

// Attendance card for the player grid
function PlayerAttendanceCard({
  row,
  onToggleAttendance,
  onSetTeam,
  tt,
}: {
  row: TrainingRow;
  onToggleAttendance: (playerId: string) => void;
  onSetTeam: (playerId: string, team: TrainingTeam | null) => void;
  tt: ReturnType<typeof useTranslations>;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggleAttendance(row.player_id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleAttendance(row.player_id); } }}
      className={`rounded-md border px-3 py-2.5 text-left transition-colors cursor-pointer ${
        row.attended
          ? "border-green-500/50 bg-green-500/10"
          : "border-border/40 hover:border-primary/30"
      }`}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <PlayerAvatar src={row.avatar_url} initials={`${row.first_name?.[0] ?? ""}${row.last_name?.[0] ?? ""}`} />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium truncate block leading-tight">
            {formatPlayerName(row)}
          </span>
          <span className="text-xs text-muted-foreground">
            #{row.jersey_number ?? "—"}
          </span>
        </div>
        {row.attended && <Check className="h-4 w-4 text-green-400 shrink-0" />}
      </div>
      <div className="flex items-center justify-between ml-11.5">
        <div className="flex items-center gap-1">
          {row.is_guest && (
            <span className="text-[9px] rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-amber-400">
              {tt("guest")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant={row.training_team === "team_a" ? "default" : "ghost"}
            className={`h-6 w-6 p-0 text-[10px] font-bold ${
              row.training_team === "team_a"
                ? "bg-white text-black hover:bg-white/90"
                : "text-muted-foreground"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSetTeam(row.player_id, row.training_team === "team_a" ? null : "team_a");
            }}
          >
            A
          </Button>
          <Button
            size="sm"
            variant={row.training_team === "team_b" ? "default" : "ghost"}
            className={`h-6 w-6 p-0 text-[10px] font-bold ${
              row.training_team === "team_b"
                ? "bg-gray-700 text-white hover:bg-gray-600"
                : "text-muted-foreground"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSetTeam(row.player_id, row.training_team === "team_b" ? null : "team_b");
            }}
          >
            B
          </Button>
        </div>
      </div>
    </div>
  );
}

// Compact row for attended players sidebar
function AttendedPlayerRow({
  row,
  onToggleAttendance,
  onSetTeam,
  tt,
}: {
  row: TrainingRow;
  onToggleAttendance: (playerId: string) => void;
  onSetTeam: (playerId: string, team: TrainingTeam | null) => void;
  tt: ReturnType<typeof useTranslations>;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", row.player_id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="flex items-center gap-2 py-1.5 px-3 border-b border-border/20 last:border-b-0 group cursor-grab active:cursor-grabbing"
    >
      <PlayerAvatar src={row.avatar_url} initials={`${row.first_name?.[0] ?? ""}${row.last_name?.[0] ?? ""}`} className="h-6 w-6" />
      <span className="text-xs font-medium truncate flex-1 min-w-0">
        {formatPlayerName(row)}
      </span>
      {row.is_guest && (
        <span className="text-[8px] rounded-full border border-amber-500/30 bg-amber-500/10 px-1 text-amber-400 shrink-0">
          {tt("guest")}
        </span>
      )}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          size="sm"
          variant={row.training_team === "team_a" ? "default" : "ghost"}
          className={`h-5 w-5 p-0 text-[9px] font-bold ${
            row.training_team === "team_a"
              ? "bg-white text-black hover:bg-white/90"
              : "text-muted-foreground"
          }`}
          onClick={() => onSetTeam(row.player_id, row.training_team === "team_a" ? null : "team_a")}
        >
          A
        </Button>
        <Button
          size="sm"
          variant={row.training_team === "team_b" ? "default" : "ghost"}
          className={`h-5 w-5 p-0 text-[9px] font-bold ${
            row.training_team === "team_b"
              ? "bg-gray-700 text-white hover:bg-gray-600"
              : "text-muted-foreground"
          }`}
          onClick={() => onSetTeam(row.player_id, row.training_team === "team_b" ? null : "team_b")}
        >
          B
        </Button>
      </div>
      <button
        type="button"
        onClick={() => onToggleAttendance(row.player_id)}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Drop zone wrapper for team groups in sidebar
function TeamDropZone({
  team,
  onSetTeam,
  children,
}: {
  team: TrainingTeam | null;
  onSetTeam: (playerId: string, team: TrainingTeam | null) => void;
  children: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const playerId = e.dataTransfer.getData("text/plain");
        if (playerId) onSetTeam(playerId, team);
      }}
      className={`transition-colors ${dragOver ? "bg-primary/5 ring-1 ring-primary/30 rounded" : ""}`}
    >
      {children}
    </div>
  );
}

export default function TrainingStatsEntryPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const tc = useTranslations("common");
  const ts = useTranslations("stats");
  const tt = useTranslations("training");
  const ta = useTranslations("admin");
  const tg = useTranslations("game");

  const [rows, setRows] = useState<TrainingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  const [sessionForm, setSessionForm] = useState({
    season_id: "",
    title: "",
    slug: "",
    session_date: "",
    location: "",
    status: "planned" as TrainingSessionStatus,
    notes: "",
    youtube_url: "",
  });
  const [sessionFormSaving, setSessionFormSaving] = useState(false);
  const [sessionFormMessage, setSessionFormMessage] = useState("");

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
      const [{ data: sessionData }, { data: players }, { data: existing }, { data: seasonsData }] =
        await Promise.all([
          supabase.from("training_sessions").select("*").eq("id", sessionId).single(),
          supabase
            .from("profiles")
            .select("*")
            .eq("is_active", true)
            .eq("is_approved", true)
            .order("first_name"),
          supabase.from("training_stats").select("*").eq("session_id", sessionId),
          supabase.from("seasons").select("*").order("start_date", { ascending: false }),
        ]);

      setSeasons((seasonsData ?? []) as Season[]);

      const statsMap = new Map((existing ?? []).map((s: TrainingStats) => [s.player_id, s]));

      const playerRows: TrainingRow[] = (players ?? []).map((p: Profile) => {
        const e = statsMap.get(p.id);
        return {
          player_id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          nickname: p.nickname,
          jersey_number: p.jersey_number,
          avatar_url: p.avatar_url,
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

      if (loadedSession) {
        setSessionForm({
          season_id: loadedSession.season_id,
          title: loadedSession.title ?? "",
          slug: loadedSession.slug ?? "",
          session_date: utcToBelgradeDateTimeLocalInput(loadedSession.session_date),
          location: loadedSession.location ?? "",
          status: normalizeStatus(loadedSession.status),
          notes: loadedSession.notes ?? "",
          youtube_url: loadedSession.youtube_url ?? "",
        });
      }

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
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)),
    [rows]
  );
  const attendedTeamB = useMemo(
    () =>
      rows
        .filter((row) => row.attended && row.training_team === "team_b")
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)),
    [rows]
  );

  const attendedRows = useMemo(
    () =>
      rows
        .filter((row) => row.attended)
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)),
    [rows]
  );
  const notAttendedRows = useMemo(
    () =>
      rows
        .filter((row) => !row.attended)
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)),
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

  async function handleSaveSessionInfo() {
    setSessionFormSaving(true);
    setSessionFormMessage("");
    setError("");

    const sessionDateUtc = belgradeDateTimeLocalInputToUtcIso(sessionForm.session_date);
    if (!sessionDateUtc) {
      setError(tt("invalidDate"));
      setSessionFormSaving(false);
      return;
    }

    const data = {
      season_id: sessionForm.season_id,
      slug: sessionForm.slug,
      session_date: sessionDateUtc,
      title: sessionForm.title || null,
      location: sessionForm.location || null,
      status: sessionForm.status,
      notes: sessionForm.notes.trim() || null,
      youtube_url: sessionForm.youtube_url.trim() || null,
    };

    const res = await supabase
      .from("training_sessions")
      .update(data)
      .eq("id", sessionId);

    if (res.error) {
      setError(res.error.message);
      setSessionFormSaving(false);
      return;
    }

    setSession((prev) =>
      prev
        ? {
            ...prev,
            ...data,
          }
        : prev
    );
    setSessionFormMessage(tt("statsSaved"));
    setSessionFormSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Group attended players by team for the sidebar
  const attendedByTeamA = attendedRows.filter((r) => r.training_team === "team_a");
  const attendedByTeamB = attendedRows.filter((r) => r.training_team === "team_b");
  const attendedNoTeam = attendedRows.filter((r) => !r.training_team);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/40 px-4 lg:px-6 py-3 sm:py-4">
        <Link
          href="/admin/training"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {tc("back")}
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold">
          {session?.title || tt("session")}
        </h1>
      </div>

      <div className="px-4 lg:px-6 pt-4">
        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
            <TabsTrigger value="info">{tt("sessionInfo")}</TabsTrigger>
            <TabsTrigger value="attendance">
              {tt("attendance")}
              <Badge variant="secondary" className="ml-1.5 text-xs">{attendedRows.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="match">{tt("trainingMatch")}</TabsTrigger>
          </TabsList>

          {/* Tab 1: Session Info */}
          <TabsContent value="info" className="space-y-4">
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle>{tt("sessionInfo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{ta("season")}</Label>
                    <Select
                      value={sessionForm.season_id}
                      onValueChange={(v) => setSessionForm({ ...sessionForm, season_id: v })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seasons.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{ta("titleOptional")}</Label>
                    <Input
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                      placeholder={tt("titlePlaceholder")}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{ta("dateAndTime")}</Label>
                    <Input
                      type="datetime-local"
                      value={sessionForm.session_date}
                      onChange={(e) => setSessionForm({ ...sessionForm, session_date: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{ta("location")}</Label>
                    <Input
                      value={sessionForm.location}
                      onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("sessionStatus")}</Label>
                    <Select
                      value={sessionForm.status}
                      onValueChange={(v) => setSessionForm({ ...sessionForm, status: normalizeStatus(v) })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SESSION_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {tt(`status.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{tt("report")}</Label>
                  <textarea
                    value={sessionForm.notes}
                    onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                    placeholder={tt("reportPlaceholder")}
                    className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tt("youtubeUrl")}</Label>
                  <Input
                    value={sessionForm.youtube_url}
                    onChange={(e) => setSessionForm({ ...sessionForm, youtube_url: e.target.value })}
                    placeholder={tt("youtubeUrlPlaceholder")}
                    className="bg-background"
                    type="url"
                  />
                  {sessionForm.youtube_url && !isValidYouTubeUrl(sessionForm.youtube_url) && (
                    <p className="text-xs text-destructive">{tt("youtubeUrlInvalid")}</p>
                  )}
                </div>
                <SlugField
                  value={sessionForm.slug}
                  onChange={(slug) => setSessionForm({ ...sessionForm, slug })}
                  onRegenerate={() =>
                    setSessionForm((f) => ({
                      ...f,
                      slug: buildTrainingSlug({ sessionDate: f.session_date, title: f.title }),
                    }))
                  }
                  table="training_sessions"
                  excludeId={sessionId}
                  baseUrl="/training"
                />
                {sessionFormMessage && (
                  <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2">
                    {sessionFormMessage}
                  </p>
                )}
                <Button
                  onClick={handleSaveSessionInfo}
                  disabled={sessionFormSaving || !sessionForm.session_date}
                  className="bg-primary"
                >
                  {sessionFormSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  {tc("save")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Attendance */}
          <TabsContent value="attendance" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{tt("attendance")}</h2>
                <Badge className="bg-primary/20 text-primary">
                  {attendedRows.length} / {rows.length}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground text-right hidden sm:block min-w-28">
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
                  <Wand2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{tt("autoAssign")}</span>
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
                    <Save className="h-4 w-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">{tc("save")}</span>
                </Button>
              </div>
            </div>

            {/* Desktop: split view */}
            <div className="hidden md:grid md:grid-cols-[1fr_280px] gap-4">
              <div>
                {notAttendedRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">{tg("allPlayersSelected")}</p>
                ) : (
                  <div className="grid gap-2 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {notAttendedRows.map((row) => (
                      <PlayerAttendanceCard
                        key={row.player_id}
                        row={row}
                        onToggleAttendance={toggleAttendance}
                        onSetTeam={setTeam}
                        tt={tt}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Card className="border-border/40 self-start sticky top-20">
                <CardHeader className="py-3 px-4 border-b border-border/30">
                  <CardTitle className="text-sm flex items-center justify-between">
                    {tg("selectedPlayers")}
                    <Badge variant="secondary" className="text-xs">{attendedRows.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-150 overflow-y-auto">
                  {attendedRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">{tg("noPlayersSelected")}</p>
                  ) : (
                    <>
                      <TeamDropZone team="team_a" onSetTeam={setTeam}>
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-secondary/30 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-white border border-border" />
                          {tt("teamA")} ({attendedByTeamA.length})
                        </div>
                        {attendedByTeamA.map((row) => (
                          <AttendedPlayerRow
                            key={row.player_id}
                            row={row}
                            onToggleAttendance={toggleAttendance}
                            onSetTeam={setTeam}
                            tt={tt}
                          />
                        ))}
                        {attendedByTeamA.length === 0 && (
                          <p className="text-[10px] text-muted-foreground/50 text-center py-2">&mdash;</p>
                        )}
                      </TeamDropZone>
                      <TeamDropZone team="team_b" onSetTeam={setTeam}>
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-secondary/30 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-gray-600" />
                          {tt("teamB")} ({attendedByTeamB.length})
                        </div>
                        {attendedByTeamB.map((row) => (
                          <AttendedPlayerRow
                            key={row.player_id}
                            row={row}
                            onToggleAttendance={toggleAttendance}
                            onSetTeam={setTeam}
                            tt={tt}
                          />
                        ))}
                        {attendedByTeamB.length === 0 && (
                          <p className="text-[10px] text-muted-foreground/50 text-center py-2">&mdash;</p>
                        )}
                      </TeamDropZone>
                      <TeamDropZone team={null} onSetTeam={setTeam}>
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-secondary/30">
                          {tt("noTeam")} ({attendedNoTeam.length})
                        </div>
                        {attendedNoTeam.map((row) => (
                          <AttendedPlayerRow
                            key={row.player_id}
                            row={row}
                            onToggleAttendance={toggleAttendance}
                            onSetTeam={setTeam}
                            tt={tt}
                            />
                          ))}
                          {attendedNoTeam.length === 0 && (
                            <p className="text-[10px] text-muted-foreground/50 text-center py-2">&mdash;</p>
                          )}
                      </TeamDropZone>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Mobile: all players in one grid */}
            <div className="md:hidden grid gap-2 sm:grid-cols-2">
              {rows
                .slice()
                .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
                .map((row) => (
                  <PlayerAttendanceCard
                    key={row.player_id}
                    row={row}
                    onToggleAttendance={toggleAttendance}
                    onSetTeam={setTeam}
                    tt={tt}
                  />
                ))}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2">
                {message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{tt("autosaveHint")}</p>
          </TabsContent>

          {/* Tab 3: Match */}
          <TabsContent value="match" className="space-y-4">
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
                      onFocus={(e) => e.target.select()}
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
                      onFocus={(e) => e.target.select()}
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
