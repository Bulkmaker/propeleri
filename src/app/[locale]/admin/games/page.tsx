"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link, useRouter } from "@/i18n/navigation";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import type {
  Game,
  Season,
  GameResult,
  Tournament,
  Opponent,
  Team,
  Profile,
} from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";
import { buildOpponentVisualLookup, resolveOpponentVisual } from "@/lib/utils/opponent-visual";

type GameForm = {
  season_id: string;
  tournament_id: string;
  opponent_id: string;
  opponent: string;
  location: string;
  game_date: string;
  is_home: boolean;
  home_score: number;
  away_score: number;
  result: GameResult;
};

type GoalEventInput = {
  scorer_player_id: string;
  assist_1_player_id: string;
  assist_2_player_id: string;
  period: GoalPeriod;
  goal_time: string;
};

type GoalPeriod = "1" | "2" | "3" | "OT" | "SO";
type GoaliePerformance = "excellent" | "good" | "average" | "bad";

type GoalieReportInput = {
  goalie_player_id: string;
  performance: GoaliePerformance;
};

type GameNotesPayload = {
  version: 1;
  goal_events: GoalEventInput[];
  goalie_report: GoalieReportInput | null;
};

const GOALIE_PERFORMANCE_OPTIONS: { value: GoaliePerformance; label: string }[] = [
  { value: "excellent", label: "Отлично" },
  { value: "good", label: "Хорошо" },
  { value: "average", label: "Нормально" },
  { value: "bad", label: "Слабо" },
];
const GOAL_PERIOD_OPTIONS: { value: GoalPeriod; label: string }[] = [
  { value: "1", label: "1 период" },
  { value: "2", label: "2 период" },
  { value: "3", label: "3 период" },
  { value: "OT", label: "ОТ" },
  { value: "SO", label: "Буллиты" },
];
const GOAL_PERIOD_VALUES = GOAL_PERIOD_OPTIONS.map((option) => option.value);

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function createEmptyGoalEvent(): GoalEventInput {
  return {
    scorer_player_id: "",
    assist_1_player_id: "",
    assist_2_player_id: "",
    period: "1",
    goal_time: "",
  };
}

function normalizeGoalClock(value: string): string {
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

function normalizeGoalEventsCount(
  events: GoalEventInput[],
  goalsCount: number
): GoalEventInput[] {
  const target = Math.max(0, goalsCount);
  const next = events.slice(0, target);
  while (next.length < target) {
    next.push(createEmptyGoalEvent());
  }
  return next;
}

function parseGameNotesPayload(notes: string | null): GameNotesPayload | null {
  if (!notes) return null;

  try {
    const parsed = JSON.parse(notes) as Partial<GameNotesPayload>;
    if (!parsed || typeof parsed !== "object") return null;

    const normalizedEvents = Array.isArray(parsed.goal_events)
      ? parsed.goal_events.map((event) => ({
          scorer_player_id: typeof event?.scorer_player_id === "string" ? event.scorer_player_id : "",
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
        }))
      : [];

    const goalieReport =
      parsed.goalie_report &&
      typeof parsed.goalie_report === "object" &&
      typeof parsed.goalie_report.goalie_player_id === "string" &&
      ["excellent", "good", "average", "bad"].includes(parsed.goalie_report.performance ?? "")
        ? {
            goalie_player_id: parsed.goalie_report.goalie_player_id,
            performance: parsed.goalie_report.performance as GoaliePerformance,
          }
        : null;

    return {
      version: 1,
      goal_events: normalizedEvents,
      goalie_report: goalieReport,
    };
  } catch {
    return null;
  }
}

function formatPlayerOption(player: Profile) {
  const number = player.jersey_number != null ? `#${player.jersey_number} ` : "";
  return `${number}${player.first_name} ${player.last_name}`;
}

export default function AdminGamesPage() {
  const t = useTranslations("admin");
  const tg = useTranslations("game");
  const tt = useTranslations("tournament");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [games, setGames] = useState<Game[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [newOpponentName, setNewOpponentName] = useState("");
  const [lineupPlayers, setLineupPlayers] = useState<Profile[]>([]);
  const [lineupLoading, setLineupLoading] = useState(false);
  const [goalEvents, setGoalEvents] = useState<GoalEventInput[]>([]);
  const [goalieReport, setGoalieReport] = useState<GoalieReportInput>({
    goalie_player_id: "",
    performance: "average",
  });

  const [form, setForm] = useState<GameForm>({
    season_id: "",
    tournament_id: "",
    opponent_id: "",
    opponent: "",
    location: "",
    game_date: "",
    is_home: true,
    home_score: 0,
    away_score: 0,
    result: "pending",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const openedFromQueryRef = useRef<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    const [gamesRes, seasonsRes, tournamentsRes, opponentsRes, teamsRes, playersRes] = await Promise.all([
      supabase.from("games").select("*").order("game_date", { ascending: false }),
      supabase.from("seasons").select("*").order("start_date", { ascending: false }),
      supabase.from("tournaments").select("*").order("start_date", { ascending: false }),
      supabase
        .from("opponents")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase.from("teams").select("*"),
      supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("jersey_number", { ascending: true }),
    ]);

    setGames((gamesRes.data ?? []) as Game[]);
    setSeasons((seasonsRes.data ?? []) as Season[]);
    setTournaments((tournamentsRes.data ?? []) as Tournament[]);
    setOpponents((opponentsRes.data ?? []) as Opponent[]);
    setTeams((teamsRes.data ?? []) as Team[]);
    setPlayers((playersRes.data ?? []) as Profile[]);

    if (seasonsRes.data?.[0]) {
      setForm((prev) =>
        prev.season_id ? prev : { ...prev, season_id: seasonsRes.data![0].id }
      );
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const findOpponentById = useCallback(
    (id: string) => opponents.find((opp) => opp.id === id) ?? null,
    [opponents]
  );

  const findOpponentByName = useCallback(
    (value: string) => {
      const normalized = normalizeName(value);
      return opponents.find((opp) => normalizeName(opp.name) === normalized) ?? null;
    },
    [opponents]
  );

  async function ensureOpponent(value: string): Promise<Opponent | null> {
    const cleaned = value.trim();
    if (!cleaned) return null;

    const local = findOpponentByName(cleaned);
    if (local) return local;

    const normalized = normalizeName(cleaned);

    const { data: existingRows } = await supabase
      .from("opponents")
      .select("*")
      .eq("normalized_name", normalized)
      .limit(1);

    if (existingRows?.[0]) {
      const existing = existingRows[0] as Opponent;
      setOpponents((prev) =>
        prev.some((item) => item.id === existing.id) ? prev : [...prev, existing]
      );
      return existing;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("opponents")
      .insert({ name: cleaned })
      .select("*")
      .single();

    if (insertError) {
      const { data: fallbackRows } = await supabase
        .from("opponents")
        .select("*")
        .eq("normalized_name", normalized)
        .limit(1);

      if (fallbackRows?.[0]) {
        const fallback = fallbackRows[0] as Opponent;
        setOpponents((prev) =>
          prev.some((item) => item.id === fallback.id) ? prev : [...prev, fallback]
        );
        return fallback;
      }

      setError(insertError.message);
      return null;
    }

    const created = inserted as Opponent;
    setOpponents((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }

  function openCreateDialog() {
    setEditingId(null);
    setEditingGame(null);
    setError("");
    setNewOpponentName("");
    setLineupPlayers([]);
    setGoalEvents([]);
    setGoalieReport({
      goalie_player_id: "",
      performance: "average",
    });
    setForm({
      season_id: seasons[0]?.id ?? "",
      tournament_id: "",
      opponent_id: "",
      opponent: "",
      location: "",
      game_date: "",
      is_home: true,
      home_score: 0,
      away_score: 0,
      result: "pending",
    });
    setDialogOpen(true);
  }

  const loadLineupPlayers = useCallback(async (gameId: string) => {
    setLineupLoading(true);
    const { data } = await supabase
      .from("game_lineups")
      .select("player:profiles(*)")
      .eq("game_id", gameId);

    const loadedPlayers = (data ?? [])
      .map((row) => {
        const candidate = row.player as unknown;
        if (Array.isArray(candidate)) {
          return (candidate[0] ?? null) as Profile | null;
        }
        return candidate as Profile | null;
      })
      .filter((player): player is Profile => Boolean(player));

    const uniquePlayers = Array.from(
      new Map(loadedPlayers.map((player) => [player.id, player])).values()
    );

    setLineupPlayers(uniquePlayers);
    setLineupLoading(false);
  }, [supabase]);

  const openEditDialog = useCallback(async (game: Game) => {
    setEditingId(game.id);
    setEditingGame(game);
    setError("");
    setNewOpponentName("");
    setLineupPlayers([]);

    const matchedOpponentId = game.opponent_id ?? findOpponentByName(game.opponent)?.id ?? "";
    const snapshotName = matchedOpponentId
      ? (findOpponentById(matchedOpponentId)?.name ?? game.opponent)
      : game.opponent;

    setForm({
      season_id: game.season_id,
      tournament_id: game.tournament_id ?? "",
      opponent_id: matchedOpponentId,
      opponent: snapshotName,
      location: game.location ?? "",
      game_date: game.game_date.slice(0, 16),
      is_home: game.is_home,
      home_score: game.home_score,
      away_score: game.away_score,
      result: game.result,
    });

    const parsedNotes = parseGameNotesPayload(game.notes);
    const parsedGoalEvents = parsedNotes?.goal_events ?? [];
    const propeleriGoals = game.is_home ? game.home_score : game.away_score;
    setGoalEvents(normalizeGoalEventsCount(parsedGoalEvents, propeleriGoals));
    setGoalieReport(
      parsedNotes?.goalie_report ?? {
        goalie_player_id: "",
        performance: "average",
      }
    );

    setDialogOpen(true);
    await loadLineupPlayers(game.id);
  }, [findOpponentById, findOpponentByName, loadLineupPlayers]);

  const gameIdFromQuery = searchParams.get("gameId");

  useEffect(() => {
    if (
      loading ||
      !gameIdFromQuery ||
      dialogOpen ||
      editingId === gameIdFromQuery ||
      openedFromQueryRef.current === gameIdFromQuery
    ) {
      return;
    }

    const game = games.find((item) => item.id === gameIdFromQuery);
    if (!game) return;

    openedFromQueryRef.current = gameIdFromQuery;
    const timer = window.setTimeout(() => {
      void openEditDialog(game);
    }, 0);
    router.replace("/admin/games");
    return () => window.clearTimeout(timer);
  }, [dialogOpen, editingId, gameIdFromQuery, games, loading, openEditDialog, router]);

  async function handleDeleteGame(gameId: string) {
    if (!window.confirm("Удалить матч и всю связанную статистику?")) return;

    setDeletingId(gameId);
    setError("");

    const [lineupDeleteRes, statsDeleteRes] = await Promise.all([
      supabase.from("game_lineups").delete().eq("game_id", gameId),
      supabase.from("game_stats").delete().eq("game_id", gameId),
    ]);

    if (lineupDeleteRes.error) {
      setError(lineupDeleteRes.error.message);
      setDeletingId(null);
      return;
    }

    if (statsDeleteRes.error) {
      setError(statsDeleteRes.error.message);
      setDeletingId(null);
      return;
    }

    const deleteRes = await supabase.from("games").delete().eq("id", gameId);
    if (deleteRes.error) {
      setError(deleteRes.error.message);
      setDeletingId(null);
      return;
    }

    if (editingId === gameId) {
      setDialogOpen(false);
    }

    await loadData();
    setDeletingId(null);
  }

  async function handleCreateOpponent() {
    if (!newOpponentName.trim()) return;
    const created = await ensureOpponent(newOpponentName);
    if (!created) return;

    setForm((prev) => ({
      ...prev,
      opponent_id: created.id,
      opponent: created.name,
    }));
    setNewOpponentName("");
  }

  function updateGoalEvent(
    index: number,
    field: keyof GoalEventInput,
    value: string
  ) {
    setGoalEvents((prev) =>
      prev.map((event, rowIndex) => {
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
      })
    );
  }

  const teamGoals = Math.max(
    0,
    editingId ? (form.is_home ? form.home_score : form.away_score) : 0
  );

  const availablePlayers = useMemo(
    () =>
      (lineupPlayers.length > 0 ? lineupPlayers : players).slice().sort((a, b) => {
        const aNumber = a.jersey_number ?? 999;
        const bNumber = b.jersey_number ?? 999;
        if (aNumber !== bNumber) return aNumber - bNumber;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      }),
    [lineupPlayers, players]
  );

  const goalieOptions = useMemo(
    () => availablePlayers.filter((player) => player.position === "goalie"),
    [availablePlayers]
  );

  async function handleSave() {
    setSaving(true);
    setError("");

    const isManagedByTournament = Boolean(editingGame?.auto_generated_from_tournament);

    if (isManagedByTournament && editingId) {
      const res = await supabase
        .from("games")
        .update({ location: form.location || null })
        .eq("id", editingId);

      if (res.error) {
        setError(res.error.message);
        setSaving(false);
        return;
      }

      setDialogOpen(false);
      setSaving(false);
      await loadData();
      return;
    }

    const cleanedGoalEvents = goalEvents
      .slice(0, teamGoals)
      .map((event) => {
        const scorerId = event.scorer_player_id;
        const assist1Id =
          event.assist_1_player_id && event.assist_1_player_id !== scorerId
            ? event.assist_1_player_id
            : "";
        const assist2Id =
          event.assist_2_player_id &&
          event.assist_2_player_id !== scorerId &&
          event.assist_2_player_id !== assist1Id
            ? event.assist_2_player_id
            : "";

        return {
          scorer_player_id: scorerId,
          assist_1_player_id: assist1Id,
          assist_2_player_id: assist2Id,
          period: GOAL_PERIOD_VALUES.includes(event.period) ? event.period : "1",
          goal_time: normalizeGoalClock(event.goal_time),
        };
      })
      .filter((event) => Boolean(event.scorer_player_id));

    const cleanedGoalieReport = goalieReport.goalie_player_id
      ? {
          goalie_player_id: goalieReport.goalie_player_id,
          performance: goalieReport.performance,
        }
      : null;

    const notesValue =
      cleanedGoalEvents.length > 0 || cleanedGoalieReport
        ? JSON.stringify({
            version: 1,
            goal_events: cleanedGoalEvents,
            goalie_report: cleanedGoalieReport,
          } as GameNotesPayload)
        : null;

    let opponentRecord = form.opponent_id ? findOpponentById(form.opponent_id) : null;

    if (!opponentRecord) {
      opponentRecord = await ensureOpponent(form.opponent);
    }

    if (!opponentRecord) {
      setError("Opponent is required");
      setSaving(false);
      return;
    }

    const payload = editingId
      ? {
          season_id: form.season_id,
          tournament_id: form.tournament_id || null,
          opponent_id: opponentRecord.id,
          opponent: opponentRecord.name,
          location: form.location || null,
          game_date: form.game_date,
          is_home: form.is_home,
          home_score: form.home_score,
          away_score: form.away_score,
          result: form.result,
          notes: notesValue,
        }
      : {
          season_id: form.season_id,
          tournament_id: form.tournament_id || null,
          opponent_id: opponentRecord.id,
          opponent: opponentRecord.name,
          location: form.location || null,
          game_date: form.game_date,
          is_home: form.is_home,
        };

    const res = editingId
      ? await supabase.from("games").update(payload).eq("id", editingId)
      : await supabase.from("games").insert(payload);

    if (res.error) {
      setError(res.error.message);
      setSaving(false);
      return;
    }

    if (editingId) {
      const { data: existingStats, error: existingStatsError } = await supabase
        .from("game_stats")
        .select("player_id, penalty_minutes, plus_minus")
        .eq("game_id", editingId);

      if (existingStatsError) {
        setError(existingStatsError.message);
        setSaving(false);
        return;
      }

      const goalsByPlayer = new Map<string, number>();
      const assistsByPlayer = new Map<string, number>();

      for (const event of cleanedGoalEvents) {
        goalsByPlayer.set(
          event.scorer_player_id,
          (goalsByPlayer.get(event.scorer_player_id) ?? 0) + 1
        );
        if (event.assist_1_player_id) {
          assistsByPlayer.set(
            event.assist_1_player_id,
            (assistsByPlayer.get(event.assist_1_player_id) ?? 0) + 1
          );
        }
        if (event.assist_2_player_id) {
          assistsByPlayer.set(
            event.assist_2_player_id,
            (assistsByPlayer.get(event.assist_2_player_id) ?? 0) + 1
          );
        }
      }

      const existingMap = new Map(
        (existingStats ?? []).map((stat) => [stat.player_id as string, stat])
      );

      const candidatePlayerIds = new Set<string>([
        ...existingMap.keys(),
        ...goalsByPlayer.keys(),
        ...assistsByPlayer.keys(),
      ]);

      const rowsToUpsert: {
        game_id: string;
        player_id: string;
        goals: number;
        assists: number;
        penalty_minutes: number;
        plus_minus: number;
      }[] = [];
      const playerIdsToDelete: string[] = [];

      for (const playerId of candidatePlayerIds) {
        const existing = existingMap.get(playerId);
        const goals = goalsByPlayer.get(playerId) ?? 0;
        const assists = assistsByPlayer.get(playerId) ?? 0;
        const penaltyMinutes = Number(existing?.penalty_minutes ?? 0);
        const plusMinus = Number(existing?.plus_minus ?? 0);

        if (goals === 0 && assists === 0 && penaltyMinutes === 0 && plusMinus === 0) {
          playerIdsToDelete.push(playerId);
          continue;
        }

        rowsToUpsert.push({
          game_id: editingId,
          player_id: playerId,
          goals,
          assists,
          penalty_minutes: penaltyMinutes,
          plus_minus: plusMinus,
        });
      }

      if (rowsToUpsert.length > 0) {
        const upsertRes = await supabase
          .from("game_stats")
          .upsert(rowsToUpsert, { onConflict: "game_id,player_id" });

        if (upsertRes.error) {
          setError(upsertRes.error.message);
          setSaving(false);
          return;
        }
      }

      if (playerIdsToDelete.length > 0) {
        const deleteStatsRes = await supabase
          .from("game_stats")
          .delete()
          .eq("game_id", editingId)
          .in("player_id", playerIdsToDelete);

        if (deleteStatsRes.error) {
          setError(deleteStatsRes.error.message);
          setSaving(false);
          return;
        }
      }
    }

    setDialogOpen(false);
    setSaving(false);
    await loadData();
  }

  const selectedOpponentId =
    form.opponent_id || (form.opponent ? findOpponentByName(form.opponent)?.id ?? "" : "");

  const opponentVisuals = useMemo(
    () => buildOpponentVisualLookup(teams, opponents),
    [teams, opponents]
  );

  const opponentHistory = useMemo(() => {
    if (!selectedOpponentId) return [];
    return games
      .filter((game) => game.opponent_id === selectedOpponentId && game.id !== editingId)
      .sort(
        (a, b) =>
          new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
      )
      .slice(0, 6);
  }, [games, selectedOpponentId, editingId]);

  const isManagedByTournament = Boolean(editingGame?.auto_generated_from_tournament);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("manageGames")}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-primary">
              <Plus className="h-4 w-4 mr-2" />
              {tc("create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? tc("edit") : tc("create")} - {tc("games")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isManagedByTournament && (
                <Badge className="bg-yellow-500/20 text-yellow-400">
                  {tt("managedByTournament")}
                </Badge>
              )}

              <div className="space-y-2">
                <Label>Sezona</Label>
                <Select
                  value={form.season_id}
                  onValueChange={(v) => setForm({ ...form, season_id: v, tournament_id: "" })}
                  disabled={isManagedByTournament}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((season) => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{tt("selectTournament")}</Label>
                <Select
                  value={form.tournament_id || "__none__"}
                  onValueChange={(v) =>
                    setForm({ ...form, tournament_id: v === "__none__" ? "" : v })
                  }
                  disabled={isManagedByTournament}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{tt("none")}</SelectItem>
                    {tournaments
                      .filter((tournament) => tournament.season_id === form.season_id)
                      .map((tournament) => (
                        <SelectItem key={tournament.id} value={tournament.id}>
                          {tournament.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{tt("opponent")}</Label>
                <Select
                  value={form.opponent_id || "__none__"}
                  onValueChange={(v) => {
                    if (v === "__none__") {
                      setForm({ ...form, opponent_id: "" });
                      return;
                    }

                    const selected = findOpponentById(v);
                    setForm({
                      ...form,
                      opponent_id: v,
                      opponent: selected?.name ?? form.opponent,
                    });
                  }}
                  disabled={isManagedByTournament}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder={tt("selectOpponent")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {opponents.map((opponent) => (
                      <SelectItem key={opponent.id} value={opponent.id}>
                        {opponent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isManagedByTournament && (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    value={newOpponentName}
                    onChange={(e) => setNewOpponentName(e.target.value)}
                    placeholder={tt("newOpponent")}
                    className="bg-background"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreateOpponent}
                    disabled={!newOpponentName.trim()}
                  >
                    {tc("create")}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <Label>{tt("opponentName")}</Label>
                <Input
                  value={form.opponent}
                  onChange={(e) => setForm({ ...form, opponent: e.target.value })}
                  className="bg-background"
                  disabled={isManagedByTournament}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Datum i vreme</Label>
                  <Input
                    type="datetime-local"
                    value={form.game_date}
                    onChange={(e) => setForm({ ...form, game_date: e.target.value })}
                    className="bg-background"
                    disabled={isManagedByTournament}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lokacija</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="bg-background"
                  />
                </div>
              </div>

              {editingId && !isManagedByTournament && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Domaci gol</Label>
                    <Input
                      type="number"
                      value={form.home_score}
                      onChange={(e) => {
                        const nextHomeScore = parseInt(e.target.value, 10) || 0;
                        setForm({
                          ...form,
                          home_score: nextHomeScore,
                        });
                        if (editingId) {
                          const nextTeamGoals = form.is_home ? nextHomeScore : form.away_score;
                          setGoalEvents((prev) => normalizeGoalEventsCount(prev, nextTeamGoals));
                        }
                      }}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gosti gol</Label>
                    <Input
                      type="number"
                      value={form.away_score}
                      onChange={(e) => {
                        const nextAwayScore = parseInt(e.target.value, 10) || 0;
                        setForm({
                          ...form,
                          away_score: nextAwayScore,
                        });
                        if (editingId) {
                          const nextTeamGoals = form.is_home ? form.home_score : nextAwayScore;
                          setGoalEvents((prev) => normalizeGoalEventsCount(prev, nextTeamGoals));
                        }
                      }}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rezultat</Label>
                    <Select
                      value={form.result}
                      onValueChange={(v) => setForm({ ...form, result: v as GameResult })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">{tg("result.pending")}</SelectItem>
                        <SelectItem value="win">{tg("result.win")}</SelectItem>
                        <SelectItem value="loss">{tg("result.loss")}</SelectItem>
                        <SelectItem value="draw">{tg("result.draw")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {editingId && !isManagedByTournament && (
                <div className="space-y-4 rounded-md border border-border/50 p-4 bg-background/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Голы и ассисты (наша команда)</p>
                      <p className="text-xs text-muted-foreground">
                        Нужно заполнить {teamGoals} {teamGoals === 1 ? "гол" : "гола/голов"}.
                      </p>
                    </div>
                    {lineupLoading && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Загрузка состава
                      </span>
                    )}
                  </div>

                  {teamGoals === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Поставьте счёт нашей команды больше 0, и поля для голов появятся автоматически.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {Array.from({ length: teamGoals }).map((_, index) => {
                        const event = goalEvents[index] ?? createEmptyGoalEvent();
                        return (
                          <div
                            key={`goal-event-${index}`}
                            className="grid gap-2 rounded-md border border-border/40 p-3 md:grid-cols-5"
                          >
                            <div className="space-y-1">
                              <Label className="text-xs">Гол #{index + 1} - автор</Label>
                              <Select
                                value={event.scorer_player_id || "__none__"}
                                onValueChange={(value) =>
                                  updateGoalEvent(
                                    index,
                                    "scorer_player_id",
                                    value === "__none__" ? "" : value
                                  )
                                }
                              >
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Выбрать игрока" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Выбрать игрока</SelectItem>
                                  {availablePlayers.map((player) => (
                                    <SelectItem key={player.id} value={player.id}>
                                      {formatPlayerOption(player)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Период</Label>
                              <Select
                                value={event.period}
                                onValueChange={(value) =>
                                  updateGoalEvent(index, "period", value)
                                }
                              >
                                <SelectTrigger className="bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GOAL_PERIOD_OPTIONS.map((periodOption) => (
                                    <SelectItem key={periodOption.value} value={periodOption.value}>
                                      {periodOption.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Время</Label>
                              <Input
                                value={event.goal_time}
                                onChange={(e) =>
                                  updateGoalEvent(index, "goal_time", e.target.value)
                                }
                                className="bg-background"
                                placeholder="мм:сс"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Ассист 1 (опционально)</Label>
                              <Select
                                value={event.assist_1_player_id || "__none__"}
                                onValueChange={(value) =>
                                  updateGoalEvent(
                                    index,
                                    "assist_1_player_id",
                                    value === "__none__" ? "" : value
                                  )
                                }
                              >
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Без ассиста" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Без ассиста</SelectItem>
                                  {availablePlayers
                                    .filter((player) => player.id !== event.scorer_player_id)
                                    .map((player) => (
                                      <SelectItem key={player.id} value={player.id}>
                                        {formatPlayerOption(player)}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Ассист 2 (опционально)</Label>
                              <Select
                                value={event.assist_2_player_id || "__none__"}
                                onValueChange={(value) =>
                                  updateGoalEvent(
                                    index,
                                    "assist_2_player_id",
                                    value === "__none__" ? "" : value
                                  )
                                }
                              >
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Без ассиста" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Без ассиста</SelectItem>
                                  {availablePlayers
                                    .filter(
                                      (player) =>
                                        player.id !== event.scorer_player_id &&
                                        player.id !== event.assist_1_player_id
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
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-2 border-t border-border/40 pt-4">
                    <Label>Вратарь и оценка игры</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Select
                        value={goalieReport.goalie_player_id || "__none__"}
                        onValueChange={(value) =>
                          setGoalieReport((prev) => ({
                            ...prev,
                            goalie_player_id: value === "__none__" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Кто стоял на воротах" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Не выбрано</SelectItem>
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
                          setGoalieReport((prev) => ({
                            ...prev,
                            performance: value as GoaliePerformance,
                          }))
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GOALIE_PERFORMANCE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {opponentHistory.length > 0 && (
                <div className="space-y-2">
                  <Label>{tt("opponentHistory")}</Label>
                  <div className="space-y-1 rounded-md border border-border/40 p-2">
                    {opponentHistory.map((game) => (
                      <div key={game.id} className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>{new Date(game.game_date).toLocaleDateString("sr-Latn")}</span>
                        <span className="font-medium text-foreground">
                          {game.is_home ? game.home_score : game.away_score} : {game.is_home ? game.away_score : game.home_score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || (!isManagedByTournament && (!form.game_date || !form.opponent.trim()))}
                  className="flex-1 bg-primary"
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tc("save")}
                </Button>
                {editingId && !isManagedByTournament && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void handleDeleteGame(editingId)}
                    disabled={deletingId === editingId}
                  >
                    {deletingId === editingId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {tc("delete")}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-6 space-y-2">
        {games.map((game) => {
          const visual = resolveOpponentVisual(game, opponentVisuals);
          const date = new Date(game.game_date);
          const teamScore = game.is_home ? game.home_score : game.away_score;
          const opponentScore = game.is_home ? game.away_score : game.home_score;
          return (
            <GameMatchCard
              key={game.id}
              teamName="Propeleri"
              opponentName={game.opponent}
              opponentLogoUrl={visual.logoUrl}
              opponentCountry={visual.country}
              teamScore={game.result === "pending" ? undefined : teamScore}
              opponentScore={game.result === "pending" ? undefined : opponentScore}
              dateLabel={date.toLocaleDateString("sr-Latn", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              timeLabel={date.toLocaleTimeString("sr-Latn", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              location={game.location}
              resultLabel={tg(`result.${game.result}`)}
              resultClassName={RESULT_COLORS[game.result as GameResult]}
              variant="compact"
              badges={
                <>
                  {game.tournament_id && (
                    <Badge className="text-xs bg-yellow-500/20 text-yellow-400">
                      {tournaments.find((tournament) => tournament.id === game.tournament_id)?.name}
                    </Badge>
                  )}
                  {game.auto_generated_from_tournament && (
                    <Badge className="text-xs bg-orange-500/20 text-orange-400">
                      {tt("managedByTournament")}
                    </Badge>
                  )}
                </>
              }
              actions={
                <div className="flex items-center gap-1">
                  <Link href={`/admin/games/${game.id}`}>
                    <Button size="sm" variant="ghost">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  {!game.auto_generated_from_tournament && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDeleteGame(game.id)}
                      disabled={deletingId === game.id}
                    >
                      {deletingId === game.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  )}
                  <Link href={`/admin/games/${game.id}/stats`}>
                    <Button size="sm" variant="outline" className="text-xs">
                      Stats
                    </Button>
                  </Link>
                  <Link href={`/games/${game.id}/lineup`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-primary/30 text-primary"
                    >
                      Lineup
                    </Button>
                  </Link>
                </div>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
