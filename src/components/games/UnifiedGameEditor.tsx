"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { formatInBelgrade } from "@/lib/utils/datetime";
import { RESULT_COLORS } from "@/lib/utils/constants";
import { formatPlayerName } from "@/lib/utils/player-name";

import { TeamAvatar } from "@/components/matches/TeamAvatar";
import { GameLineupEditor } from "@/components/games/GameLineupEditor";
import { GameMatchCard } from "@/components/matches/GameMatchCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  belgradeDateTimeLocalInputToUtcIso,
  utcToBelgradeDateTimeLocalInput,
} from "@/lib/utils/datetime";
import {
  ArrowLeftRight,
  Check,
  Loader2,
  Save,
} from "lucide-react";
import type {
  Game,
  LineupDesignation,
  Profile,
  SlotPosition,
  Team,
  Tournament,
  TournamentGroup,
  TournamentGroupTeam,
  TournamentMatch,
  TournamentMatchStage,
} from "@/types/database";

type MatchFormState = {
  team_a_id: string;
  team_b_id: string;
  stage: TournamentMatchStage;
  group_id: string;
  match_date: string;
  bracket_label: string;
  score_a: number;
  score_b: number;
  is_completed: boolean;
};

type StatsRowState = {
  player_id: string;
  player_name: string;
  jersey_number: number | null;
  goals: number;
  assists: number;
  penalty_minutes: number;
  plus_minus: number;
};

type PlayerSummary = Pick<Profile, "first_name" | "last_name" | "jersey_number">;
type PlayerRelation = PlayerSummary | PlayerSummary[] | null;

type LineupRowRecord = {
  player_id: string;
  designation: LineupDesignation;
  line_number: number | null;
  slot_position: SlotPosition | null;
  player: PlayerRelation;
};

type StatsRowRecord = {
  player_id: string;
  goals: number;
  assists: number;
  penalty_minutes: number;
  plus_minus: number;
  player: PlayerRelation;
};

interface UnifiedGameEditorProps {
  gameId: string;
  onRefresh?: () => void;
}

function toDateTimeLocalInput(value: string | null): string {
  return utcToBelgradeDateTimeLocalInput(value);
}

function extractPlayer(player: PlayerRelation): PlayerSummary | null {
  if (!player) return null;
  if (Array.isArray(player)) return player[0] ?? null;
  return player;
}

function sortPlayersByNumberAndName(list: Profile[]) {
  return [...list].sort((a, b) => {
    const aNumber = a.jersey_number ?? 999;
    const bNumber = b.jersey_number ?? 999;
    if (aNumber !== bNumber) return aNumber - bNumber;
    return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
  });
}

export function UnifiedGameEditor({ gameId, onRefresh }: UnifiedGameEditorProps) {
  const locale = useLocale();
  const tt = useTranslations("tournament");
  const tc = useTranslations("common");
  const ts = useTranslations("stats");
  const tg = useTranslations("game");

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<null | "match" | "roster" | "stats">(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [match, setMatch] = useState<TournamentMatch | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<TournamentGroup[]>([]);
  const [groupTeams, setGroupTeams] = useState<TournamentGroupTeam[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [registeredPlayerIds, setRegisteredPlayerIds] = useState<string[]>([]);

  const [form, setForm] = useState<MatchFormState>({
    team_a_id: "",
    team_b_id: "",
    stage: "group",
    group_id: "",
    match_date: "",
    bracket_label: "",
    score_a: 0,
    score_b: 0,
    is_completed: false,
  });

  const [statsRows, setStatsRows] = useState<StatsRowState[]>([]);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const registeredSet = useMemo(() => new Set(registeredPlayerIds), [registeredPlayerIds]);

  const findGroupForMatch = useCallback(
    (teamAId: string, teamBId: string): string | null => {
      for (const group of groups) {
        const memberIds = groupTeams
          .filter((entry) => entry.group_id === group.id)
          .map((entry) => entry.team_id);

        if (memberIds.includes(teamAId) && memberIds.includes(teamBId)) {
          return group.id;
        }
      }

      return null;
    },
    [groups, groupTeams]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);

    // Загружаем game
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !gameData) {
      setError(tg("gameNotFound"));
      setLoading(false);
      return;
    }

    setGame(gameData);

    // Загружаем tournament_match по game_id
    const { data: matchData } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("game_id", gameId)
      .maybeSingle();

    setMatch(matchData);

    // Если нет tournamentMatch, загружаем только базовые данные
    if (!matchData) {
      const [playersRes, teamsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("is_active", true)
          .eq("is_approved", true)
          .eq("is_guest", false)
          .order("jersey_number", { ascending: true }),
        supabase.from("teams").select("*").order("name"),
      ]);

      setPlayers((playersRes.data ?? []) as Profile[]);
      setTeams((teamsRes.data ?? []) as Team[]);
      setLoading(false);
      return;
    }

    // Если есть tournamentMatch, загружаем полные данные турнира
    const [
      tournamentRes,
      junctionsRes,
      allTeamsRes,
      groupsRes,
      groupTeamsRes,
      playersRes,
      registrationsRes,
    ] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", matchData.tournament_id).maybeSingle(),
      supabase
        .from("tournament_teams")
        .select("*")
        .eq("tournament_id", matchData.tournament_id)
        .order("sort_order"),
      supabase.from("teams").select("*").order("name"),
      supabase
        .from("tournament_groups")
        .select("*")
        .eq("tournament_id", matchData.tournament_id)
        .order("sort_order"),
      supabase.from("tournament_group_teams").select("*"),
      supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .eq("is_approved", true)
        .eq("is_guest", false)
        .order("jersey_number", { ascending: true }),
      supabase
        .from("tournament_player_registrations")
        .select("player_id")
        .eq("tournament_id", matchData.tournament_id),
    ]);

    const loadedTournament = (tournamentRes.data ?? null) as Tournament | null;
    setTournament(loadedTournament);

    const allTeams = (allTeamsRes.data ?? []) as Team[];
    const tournamentTeams = (junctionsRes.data ?? []) as { team_id: string }[];
    const loadedTeamIds = new Set(tournamentTeams.map((row) => row.team_id));
    const loadedTeams = allTeams.filter((team) => loadedTeamIds.has(team.id));

    const loadedGroups = (groupsRes.data ?? []) as TournamentGroup[];
    const loadedGroupIds = new Set(loadedGroups.map((group) => group.id));
    const loadedGroupTeams = ((groupTeamsRes.data ?? []) as TournamentGroupTeam[]).filter((row) =>
      loadedGroupIds.has(row.group_id)
    );

    const loadedPlayers = (playersRes.data ?? []) as Profile[];
    const loadedRegistrations = ((registrationsRes.data ?? []) as { player_id: string }[]).map(
      (row) => row.player_id
    );

    setTeams(loadedTeams);
    setGroups(loadedGroups);
    setGroupTeams(loadedGroupTeams);
    setPlayers(loadedPlayers);
    setRegisteredPlayerIds(loadedRegistrations);

    setForm({
      team_a_id: matchData.team_a_id ?? "",
      team_b_id: matchData.team_b_id ?? "",
      stage: matchData.stage,
      group_id: matchData.group_id ?? "",
      match_date: toDateTimeLocalInput(matchData.match_date),
      bracket_label: matchData.bracket_label ?? "",
      score_a: matchData.score_a,
      score_b: matchData.score_b,
      is_completed: matchData.is_completed,
    });

    // Загружаем статистику
    const [lineupRes, statsRes] = await Promise.all([
      supabase
        .from("game_lineups")
        .select("player_id, designation, line_number, slot_position, player:profiles(first_name, last_name, jersey_number)")
        .eq("game_id", gameId)
        .order("line_number", { ascending: true })
        .order("slot_position", { ascending: true }),
      supabase
        .from("game_stats")
        .select("player_id, goals, assists, penalty_minutes, plus_minus, player:profiles(first_name, last_name, jersey_number)")
        .eq("game_id", gameId),
    ]);

    const lineupData = (lineupRes.data ?? []) as LineupRowRecord[];
    const statsData = (statsRes.data ?? []) as StatsRowRecord[];

    const lineupPlayerIds = lineupData
      .filter((entry) => Boolean(entry.slot_position))
      .map((entry) => entry.player_id)
      .filter((playerId) => Boolean(playerId));

    const rosterById = new Map(loadedPlayers.map((player) => [player.id, player]));
    const statsById = new Map(statsData.map((row) => [row.player_id, row]));

    const fallbackPlayerIds = statsData.map((row) => row.player_id);

    const sourcePlayerIds =
      lineupPlayerIds.length > 0
        ? Array.from(new Set(lineupPlayerIds))
        : Array.from(new Set(fallbackPlayerIds));

    const nextStatsRows: StatsRowState[] = sourcePlayerIds.map((playerId) => {
      const stat = statsById.get(playerId);
      const statPlayer = stat ? extractPlayer(stat.player) : null;
      const rosterPlayer = rosterById.get(playerId);

      const firstName = statPlayer?.first_name ?? rosterPlayer?.first_name ?? tc("player");
      const lastName = statPlayer?.last_name ?? rosterPlayer?.last_name ?? "";
      const jersey =
        statPlayer?.jersey_number ?? rosterPlayer?.jersey_number ?? null;

      return {
        player_id: playerId,
        player_name: `${firstName} ${lastName}`.trim(),
        jersey_number: jersey,
        goals: stat?.goals ?? 0,
        assists: stat?.assists ?? 0,
        penalty_minutes: stat?.penalty_minutes ?? 0,
        plus_minus: stat?.plus_minus ?? 0,
      };
    });

    setStatsRows(nextStatsRows);
    setLoading(false);
  }, [gameId, supabase, tc, tg]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  const selectedTeamA = teamById.get(form.team_a_id);
  const selectedTeamB = teamById.get(form.team_b_id);
  const hasPropeleriTeam = Boolean(selectedTeamA?.is_propeleri || selectedTeamB?.is_propeleri);
  const selectedGroupTeamIds =
    form.stage === "group" && form.group_id
      ? new Set(
        groupTeams
          .filter((entry) => entry.group_id === form.group_id)
          .map((entry) => entry.team_id)
      )
      : null;
  const scopedTeams =
    selectedGroupTeamIds && selectedGroupTeamIds.size > 0
      ? teams.filter((team) => selectedGroupTeamIds.has(team.id))
      : teams;
  const scopedTeamBOptions = scopedTeams.filter((team) => team.id !== form.team_a_id);

  async function saveGameFields() {
    if (!game) return;

    setSavingAction("match");
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("games")
      .update({
        opponent_team_id: game.opponent_team_id,
        location: game.location,
        game_date: game.game_date,
        home_score: game.home_score,
        away_score: game.away_score,
        is_home: game.is_home,
        result: game.result,
      })
      .eq("id", gameId);

    if (updateError) {
      setError(updateError.message);
      setSavingAction(null);
      return;
    }

    await loadAll();
    setSavingAction(null);
    setSuccess(tg("matchSaved"));
    onRefresh?.();
  }

  async function saveMatch() {
    if (!match) return;

    const hasBothTeams = Boolean(form.team_a_id && form.team_b_id);
    const hasOneTeamOnly = Boolean(form.team_a_id) !== Boolean(form.team_b_id);
    if (form.stage === "group" && !hasBothTeams) {
      setError(tt("errorBothTeamsGroup"));
      return;
    }

    if (form.stage === "playoff" && hasOneTeamOnly) {
      setError(tt("errorBothTeamsPlayoff"));
      return;
    }

    if (hasBothTeams && form.team_a_id === form.team_b_id) {
      setError(tt("errorDifferentTeams"));
      return;
    }

    setSavingAction("match");
    setError("");
    setSuccess("");

    const resolvedGroupId =
      form.stage === "group"
        ? form.group_id ||
        (form.team_a_id && form.team_b_id
          ? findGroupForMatch(form.team_a_id, form.team_b_id)
          : null)
        : null;
    const matchDateUtc = form.match_date
      ? belgradeDateTimeLocalInputToUtcIso(form.match_date)
      : null;
    if (form.match_date && !matchDateUtc) {
      setError(tt("errorInvalidDate"));
      setSavingAction(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("tournament_matches")
      .update({
        team_a_id: form.team_a_id || null,
        team_b_id: form.team_b_id || null,
        stage: form.stage,
        group_id: resolvedGroupId,
        match_date: matchDateUtc,
        bracket_label: form.bracket_label.trim() || null,
        score_a: Math.max(0, form.score_a),
        score_b: Math.max(0, form.score_b),
        is_completed: form.is_completed,
      })
      .eq("id", match.id);

    if (updateError) {
      setError(updateError.message);
      setSavingAction(null);
      return;
    }

    await loadAll();
    setSavingAction(null);
    setSuccess(tt("matchSaved"));
    onRefresh?.();
  }

  async function toggleRegisteredPlayer(playerId: string) {
    if (!tournament) return;

    setSavingAction("roster");
    setError("");
    setSuccess("");

    const isRegistered = registeredSet.has(playerId);

    const result = isRegistered
      ? await supabase
        .from("tournament_player_registrations")
        .delete()
        .eq("tournament_id", tournament.id)
        .eq("player_id", playerId)
      : await supabase
        .from("tournament_player_registrations")
        .insert({ tournament_id: tournament.id, player_id: playerId });

    if (result.error) {
      setError(result.error.message);
      setSavingAction(null);
      return;
    }

    setRegisteredPlayerIds((prev) =>
      isRegistered ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
    setSavingAction(null);
    setSuccess(tt("rosterSaved"));
  }

  function updateStatRow(playerId: string, field: keyof Omit<StatsRowState, "player_id" | "player_name" | "jersey_number">, value: number) {
    setStatsRows((prev) =>
      prev.map((row) =>
        row.player_id === playerId
          ? {
            ...row,
            [field]: field === "plus_minus" ? value : Math.max(0, value),
          }
          : row
      )
    );
  }

  async function saveStats() {
    if (!game) {
      setError(tt("errorNoGame"));
      return;
    }

    setSavingAction("stats");
    setError("");
    setSuccess("");

    const duplicateCheck = new Set<string>();
    for (const row of statsRows) {
      if (duplicateCheck.has(row.player_id)) {
        setError(tt("errorDuplicatePlayer"));
        setSavingAction(null);
        return;
      }
      duplicateCheck.add(row.player_id);
    }

    const { error: deleteError } = await supabase
      .from("game_stats")
      .delete()
      .eq("game_id", gameId);

    if (deleteError) {
      setError(deleteError.message);
      setSavingAction(null);
      return;
    }

    const payload = statsRows.map((row) => ({
      game_id: gameId,
      player_id: row.player_id,
      goals: Math.max(0, row.goals),
      assists: Math.max(0, row.assists),
      penalty_minutes: Math.max(0, row.penalty_minutes),
      plus_minus: row.plus_minus,
    }));

    if (payload.length > 0) {
      const { error: insertError } = await supabase.from("game_stats").insert(payload);
      if (insertError) {
        setError(insertError.message);
        setSavingAction(null);
        return;
      }
    }

    setSavingAction(null);
    setSuccess(tt("statsSaved"));
    onRefresh?.();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!game) {
    return <div className="p-6 text-center text-muted-foreground">{tg("gameNotFound")}</div>;
  }

  const isTournamentMatch = Boolean(match);

  // Подготовка данных для GameMatchCard
  const opponentTeam = game.opponent_team || teams.find((t) => t.id === game.opponent_team_id);
  const opponentName = opponentTeam?.name ?? game.opponent ?? tg("unknownOpponent");
  const opponentLogo = opponentTeam?.logo_url;
  const opponentCountry = opponentTeam?.country;

  const dateLabel = formatInBelgrade(game.game_date, locale, {
    month: "short",
    day: "numeric",
  });
  const timeLabel = formatInBelgrade(game.game_date, locale, {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  // Единая структура для всех матчей
  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2">
          {success}
        </p>
      )}

      <GameMatchCard
        teamName="Propeleri"
        opponentName={opponentName}
        opponentLogoUrl={opponentLogo}
        opponentCountry={opponentCountry}
        teamScore={game.result === "pending" ? undefined : game.is_home ? game.home_score : game.away_score}
        opponentScore={game.result === "pending" ? undefined : game.is_home ? game.away_score : game.home_score}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        location={game.location}
        resultLabel={tg(`result.${game.result}`)}
        resultClassName={RESULT_COLORS[game.result as keyof typeof RESULT_COLORS]}
        matchTimeLabel={tg("matchTime")}
        variant="compact"
      />

      <Tabs defaultValue="match" className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
          <TabsTrigger value="match">{tt("matchAndTime")}</TabsTrigger>
          {isTournamentMatch && (
            <>
              <TabsTrigger value="opponent">{tt("opponent")}</TabsTrigger>
              <TabsTrigger value="roster">{tt("roster")}</TabsTrigger>
            </>
          )}
          <TabsTrigger value="lineup">{tt("lineup")}</TabsTrigger>
          <TabsTrigger value="stats">{tt("statistics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="match" className="space-y-4">
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-4">
              {!isTournamentMatch ? (
                // Обычный матч - редактирование базовых полей game
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{tg("opponent")}</Label>
                      <Select
                        value={game.opponent_team_id || "__none__"}
                        onValueChange={(value) => {
                          if (value === "__none__") {
                            setGame({ ...game, opponent_team_id: null });
                          } else {
                            const team = teams.find(t => t.id === value);
                            if (team) {
                              setGame({ ...game, opponent_team_id: value });
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={tg("selectOpponent")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {teams
                            .filter(t => !t.is_propeleri) // Assuming Propeleri is not an opponent to itself usually
                            .map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{tg("venue")}</Label>
                      <Input
                        value={game.location || ""}
                        onChange={(e) => setGame({ ...game, location: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{tg("dateAndTime")}</Label>
                      <Input
                        type="datetime-local"
                        value={toDateTimeLocalInput(game.game_date)}
                        onChange={(e) => {
                          const utcDate = belgradeDateTimeLocalInputToUtcIso(e.target.value);
                          if (utcDate) {
                            setGame({ ...game, game_date: utcDate });
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{tg("homeAway")}</Label>
                      <Select
                        value={game.is_home ? "home" : "away"}
                        onValueChange={(value) => setGame({ ...game, is_home: value === "home" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="home">{tg("homeLabel")}</SelectItem>
                          <SelectItem value="away">{tg("awayLabel")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{tg("scoreUs")}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={game.is_home ? game.home_score : game.away_score}
                        onChange={(e) => {
                          const score = parseInt(e.target.value, 10) || 0;
                          if (game.is_home) {
                            setGame({ ...game, home_score: score });
                          } else {
                            setGame({ ...game, away_score: score });
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{tg("scoreOpponent")}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={game.is_home ? game.away_score : game.home_score}
                        onChange={(e) => {
                          const score = parseInt(e.target.value, 10) || 0;
                          if (game.is_home) {
                            setGame({ ...game, away_score: score });
                          } else {
                            setGame({ ...game, home_score: score });
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{tg("resultLabel")}</Label>
                      <Select
                        value={game.result}
                        onValueChange={(value: string) => setGame({ ...game, result: value as Game["result"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="win">{tg("result.win")}</SelectItem>
                          <SelectItem value="loss">{tg("result.loss")}</SelectItem>
                          <SelectItem value="draw">{tg("result.draw")}</SelectItem>
                          <SelectItem value="pending">{tg("result.pending")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={() => void saveGameFields()}
                    disabled={savingAction === "match"}
                  >
                    {savingAction === "match" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {tc("save")}
                  </Button>
                </>
              ) : (
                // Турнирный матч - турнирные поля
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{tt("stage")}</Label>
                      <Select
                        value={form.stage}
                        disabled={!isTournamentMatch}
                        onValueChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            stage: value as TournamentMatchStage,
                            group_id: value === "group" ? prev.group_id : "",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="group">{tt("groupStage")}</SelectItem>
                          <SelectItem value="playoff">{tt("playoffStage")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.stage === "group" ? (
                      <div className="space-y-2">
                        <Label>{tt("group")}</Label>
                        <Select
                          value={form.group_id || "__none__"}
                          disabled={!isTournamentMatch}
                          onValueChange={(value) =>
                            setForm((prev) => {
                              const nextGroupId = value === "__none__" ? "" : value;
                              if (!nextGroupId) {
                                return { ...prev, group_id: "" };
                              }

                              const allowedIds = new Set(
                                groupTeams
                                  .filter((entry) => entry.group_id === nextGroupId)
                                  .map((entry) => entry.team_id)
                              );

                              let teamAId = prev.team_a_id;
                              let teamBId = prev.team_b_id;

                              if (allowedIds.size > 0) {
                                if (teamAId && !allowedIds.has(teamAId)) teamAId = "";
                                if (teamBId && !allowedIds.has(teamBId)) teamBId = "";
                              }

                              if (teamAId && teamBId && teamAId === teamBId) {
                                teamBId = "";
                              }

                              return {
                                ...prev,
                                group_id: nextGroupId,
                                team_a_id: teamAId,
                                team_b_id: teamBId,
                              };
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {groups.map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>{tt("label")}</Label>
                        <Input
                          value={form.bracket_label}
                          disabled={!isTournamentMatch}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, bracket_label: event.target.value }))
                          }
                          placeholder={tt("labelPlaceholder")}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{tt("matchDate")}</Label>
                      <Input
                        type="datetime-local"
                        value={form.match_date}
                        disabled={!isTournamentMatch}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, match_date: event.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{tt("location")}</Label>
                      <Input
                        value={tournament?.location ?? ""}
                        placeholder={tt("scorePlaceholder")}
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">
                        {tt("locationFromTournament")}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{tt("score")} A</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.score_a}
                        disabled={!isTournamentMatch}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            score_a: parseInt(event.target.value, 10) || 0,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{tt("score")} B</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.score_b}
                        disabled={!isTournamentMatch}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            score_b: parseInt(event.target.value, 10) || 0,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{tt("completed")}</Label>
                      <Button
                        type="button"
                        variant={form.is_completed ? "default" : "outline"}
                        className="w-full"
                        disabled={!isTournamentMatch}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, is_completed: !prev.is_completed }))
                        }
                      >
                        {form.is_completed ? tt("reopen") : tt("complete")}
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={() => void saveMatch()}
                    disabled={!isTournamentMatch || savingAction === "match"}
                  >
                    {savingAction === "match" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {tc("save")}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opponent" className="space-y-4">
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-4">
              {!isTournamentMatch && (
                <p className="text-sm text-muted-foreground border-l-4 border-yellow-500 pl-3 py-2">
                  {tg("tournamentFieldsOnly")}
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-end">
                <div className="space-y-2">
                  <Label>{tt("selectTeamA")}</Label>
                  <Select
                    value={form.team_a_id || "__none__"}
                    disabled={!isTournamentMatch}
                    onValueChange={(value) =>
                      setForm((prev) => {
                        const nextTeamAId = value === "__none__" ? "" : value;
                        return {
                          ...prev,
                          team_a_id: nextTeamAId,
                          team_b_id: prev.team_b_id === nextTeamAId ? "" : prev.team_b_id,
                        };
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {scopedTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  disabled={!isTournamentMatch}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      team_a_id: prev.team_b_id,
                      team_b_id: prev.team_a_id,
                    }))
                  }
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>

                <div className="space-y-2">
                  <Label>{tt("selectTeamB")}</Label>
                  <Select
                    value={form.team_b_id || "__none__"}
                    disabled={!isTournamentMatch}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        team_b_id: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {scopedTeamBOptions.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.stage === "group" && form.group_id && scopedTeams.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {tt("noTeamsInGroup")}
                </p>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-border/40 p-3">
                  <div className="flex items-center gap-2">
                    <TeamAvatar
                      name={selectedTeamA?.name ?? tt("teamA")}
                      logoUrl={selectedTeamA?.logo_url}
                      country={selectedTeamA?.country}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{selectedTeamA?.name ?? tc("notSelected")}</p>
                      {selectedTeamA?.is_propeleri && (
                        <Badge className="bg-primary/20 text-primary text-xs mt-1">{tt("propeleri")}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-border/40 p-3">
                  <div className="flex items-center gap-2">
                    <TeamAvatar
                      name={selectedTeamB?.name ?? tt("teamB")}
                      logoUrl={selectedTeamB?.logo_url}
                      country={selectedTeamB?.country}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{selectedTeamB?.name ?? tc("notSelected")}</p>
                      {selectedTeamB?.is_propeleri && (
                        <Badge className="bg-primary/20 text-primary text-xs mt-1">{tt("propeleri")}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {hasPropeleriTeam
                  ? tt("lineupAvailable")
                  : tt("lineupNotAvailable")}
              </p>

              <Button
                onClick={() => void saveMatch()}
                disabled={!isTournamentMatch || savingAction === "match"}
              >
                {savingAction === "match" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {tc("save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roster" className="space-y-4">
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-4">
              {!isTournamentMatch && (
                <p className="text-sm text-muted-foreground border-l-4 border-yellow-500 pl-3 py-2">
                  {tg("tournamentRosterOnly")}
                </p>
              )}

              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{tt("tournamentRoster")}</h2>
                <Badge className="bg-primary/20 text-primary">{registeredPlayerIds.length} {tc("selected")}</Badge>
              </div>

              {players.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tt("noAvailablePlayers")}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {sortPlayersByNumberAndName(players).map((player) => {
                    const isSelected = registeredSet.has(player.id);
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => void toggleRegisteredPlayer(player.id)}
                        disabled={!isTournamentMatch || savingAction === "roster"}
                        className={`rounded-md border px-3 py-2 text-left transition-colors ${isSelected
                          ? "border-primary/50 bg-primary/10"
                          : "border-border/40 hover:border-primary/30"
                          } ${!isTournamentMatch ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            {formatPlayerName(player)}
                          </span>
                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          #{player.jersey_number ?? "—"} · {player.position}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lineup" className="space-y-4">
          <GameLineupEditor
            gameId={gameId}
            embedded
            backHref={null}
          />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{tt("playerStats")}</h2>
                <Button
                  type="button"
                  onClick={() => void saveStats()}
                  disabled={savingAction === "stats"}
                >
                  {savingAction === "stats" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {tc("save")}
                </Button>
              </div>

              {statsRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tt("noPlayersForStats")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-2 py-2">{tt("playerColumn")}</th>
                        <th className="text-center px-2 py-2">{ts("goals")}</th>
                        <th className="text-center px-2 py-2">{ts("assists")}</th>
                        <th className="text-center px-2 py-2">{ts("penaltyMinutes")}</th>
                        <th className="text-center px-2 py-2">{ts("plusMinus")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsRows.map((row) => (
                        <tr key={row.player_id} className="border-b border-border/30">
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className="font-medium">
                              {row.jersey_number != null ? `#${row.jersey_number} ` : ""}
                              {row.player_name}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.goals}
                              onChange={(event) =>
                                updateStatRow(
                                  row.player_id,
                                  "goals",
                                  parseInt(event.target.value, 10) || 0
                                )
                              }
                              className="w-16 mx-auto text-center"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.assists}
                              onChange={(event) =>
                                updateStatRow(
                                  row.player_id,
                                  "assists",
                                  parseInt(event.target.value, 10) || 0
                                )
                              }
                              className="w-16 mx-auto text-center"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.penalty_minutes}
                              onChange={(event) =>
                                updateStatRow(
                                  row.player_id,
                                  "penalty_minutes",
                                  parseInt(event.target.value, 10) || 0
                                )
                              }
                              className="w-16 mx-auto text-center"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              value={row.plus_minus}
                              onChange={(event) =>
                                updateStatRow(
                                  row.player_id,
                                  "plus_minus",
                                  parseInt(event.target.value, 10) || 0
                                )
                              }
                              className="w-16 mx-auto text-center"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {game?.location && (
        <p className="text-xs text-muted-foreground">
          {tt("gameLocation", { location: game.location })}
        </p>
      )}
    </div>
  );
}
