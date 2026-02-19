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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  X,
} from "lucide-react";
import { POSITION_COLORS } from "@/lib/utils/constants";
import { isValidYouTubeUrl } from "@/lib/utils/youtube";
import { updateGameStats } from "@/lib/utils/game-stats";
import { SlugField } from "@/components/admin/SlugField";
import { buildGameSlug } from "@/lib/utils/match-slug";
import {
  GoalEventsEditor,
  normalizeGoalClock,
  normalizeGoalEventsCount,
  parseGameNotesPayload,
} from "@/components/admin/games/GoalEventsEditor";
import type {
  Game,
  GameNotesPayload,
  GoalEventInput,
  GoalieReportInput,
  PenaltyEventInput,
  PlayerPosition,
  Profile,
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
  shootout_winner: "team_a" | "team_b" | null;
};


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

interface UnifiedGameEditorProps {
  gameId: string;
  onRefresh?: () => void;
}

function toDateTimeLocalInput(value: string | null): string {
  return utcToBelgradeDateTimeLocalInput(value);
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
  const tg = useTranslations("game");

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<null | "match" | "roster" | "goals">(null);
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
    shootout_winner: null,
  });

  const [goalEvents, setGoalEvents] = useState<GoalEventInput[]>([]);
  const [penaltyEvents, setPenaltyEvents] = useState<PenaltyEventInput[]>([]);
  const [goalieReport, setGoalieReport] = useState<GoalieReportInput>({
    goalie_player_id: "",
    performance: "average",
  });
  const [lineupIds, setLineupIds] = useState<string[]>([]);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const registeredSet = useMemo(() => new Set(registeredPlayerIds), [registeredPlayerIds]);
  const sortedPlayers = useMemo(() => sortPlayersByNumberAndName(players), [players]);
  const goalEventPlayers = useMemo(() => {
    if (lineupIds.length === 0) return sortedPlayers;
    const idSet = new Set(lineupIds);
    return sortedPlayers.filter((p) => idSet.has(p.id));
  }, [lineupIds, sortedPlayers]);

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

  const loadAll = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);

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

    // Parse goal events from notes
    const parsedNotes = parseGameNotesPayload(gameData.notes as string | null);
    if (parsedNotes) {
      setGoalEvents(parsedNotes.goal_events);
      setPenaltyEvents(parsedNotes.penalty_events);
      setGoalieReport(parsedNotes.goalie_report ?? { goalie_player_id: "", performance: "average" });
    } else {
      setGoalEvents([]);
      setPenaltyEvents([]);
      setGoalieReport({ goalie_player_id: "", performance: "average" });
    }

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
      shootout_winner: matchData.shootout_winner,
    });

    // Загружаем lineup для определения goalEventPlayers
    const { data: lineupData } = await supabase
      .from("game_lineups")
      .select("player_id, slot_position")
      .eq("game_id", gameId)
      .order("line_number", { ascending: true })
      .order("slot_position", { ascending: true });

    const lineupPlayerIds = (lineupData ?? [])
      .filter((entry) => Boolean(entry.slot_position))
      .map((entry) => entry.player_id)
      .filter((playerId) => Boolean(playerId));

    setLineupIds(lineupPlayerIds);
    setLoading(false);
  }, [gameId, supabase, tg]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll(true);
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
    if (game.youtube_url && !isValidYouTubeUrl(game.youtube_url)) {
      setError(tg("youtubeUrlInvalid"));
      return;
    }

    setSavingAction("match");
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("games")
      .update({
        opponent_team_id: game.opponent_team_id,
        slug: game.slug,
        location: game.location,
        game_date: game.game_date,
        home_score: game.home_score,
        away_score: game.away_score,
        is_home: game.is_home,
        result: game.result,
        youtube_url: game.youtube_url,
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
    if (game?.youtube_url && !isValidYouTubeUrl(game.youtube_url)) {
      setError(tg("youtubeUrlInvalid"));
      return;
    }

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

    const hasMatchFieldChanges =
      form.team_a_id !== (match.team_a_id ?? "") ||
      form.team_b_id !== (match.team_b_id ?? "") ||
      form.stage !== match.stage ||
      form.group_id !== (match.group_id ?? "") ||
      form.match_date !== toDateTimeLocalInput(match.match_date) ||
      form.bracket_label !== (match.bracket_label ?? "") ||
      form.score_a !== match.score_a ||
      form.score_b !== match.score_b ||
      form.is_completed !== match.is_completed ||
      form.shootout_winner !== match.shootout_winner;

    if (hasMatchFieldChanges) {
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
          shootout_winner: form.shootout_winner,
        })
        .eq("id", match.id);

      if (updateError) {
        setError(updateError.message);
        setSavingAction(null);
        return;
      }
    }

    const { error: gameUpdateError } = await supabase
      .from("games")
      .update({
        youtube_url: game?.youtube_url?.trim() || null,
      })
      .eq("id", gameId);

    if (gameUpdateError) {
      setError(gameUpdateError.message);
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

  async function saveGoals() {
    if (!game) {
      setError(tg("gameNotFound"));
      return;
    }

    setSavingAction("goals");
    setError("");
    setSuccess("");

    const regulationGoals = getRegulationGoals();
    const cleanedEvents = normalizeGoalEventsCount(goalEvents, regulationGoals)
      .filter((e) => e.scorer_player_id)
      .map((e) => ({
        ...e,
        period: e.period || "1",
        goal_time: normalizeGoalClock(e.goal_time || ""),
        video_url: e.video_url?.trim() || "",
      }));

    const cleanedPenalties = penaltyEvents.filter((e) => e.player_id);

    const payload: GameNotesPayload = {
      version: 1,
      goal_events: cleanedEvents,
      penalty_events: cleanedPenalties,
      goalie_report: goalieReport.goalie_player_id ? goalieReport : null,
    };

    const notesJson = JSON.stringify(payload);
    const { error: updateError } = await supabase
      .from("games")
      .update({ notes: notesJson })
      .eq("id", gameId);

    if (updateError) {
      setError(updateError.message);
      setSavingAction(null);
      return;
    }

    await updateGameStats(supabase, gameId, notesJson);

    setSavingAction(null);
    setSuccess(tg("goalsSaved"));
    await loadAll();
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

  // Regulation goals for our team (subtract 1 if our team won shootout — that +1 is not a real goal)
  function getRegulationGoals(): number {
    if (!game) return 0;
    const rawScore = game.is_home ? game.home_score : game.away_score;
    if (!form.shootout_winner) return rawScore;
    // is_home=true means Propeleri=team_a. If shootout_winner matches our side, subtract 1.
    const ourSideWon = game.is_home
      ? form.shootout_winner === "team_a"
      : form.shootout_winner === "team_b";
    return ourSideWon ? Math.max(0, rawScore - 1) : rawScore;
  }

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
        shootoutLabel={isTournamentMatch && form.shootout_winner ? tt("shootoutShort") : undefined}
        shootoutSide={
          form.shootout_winner
            ? selectedTeamA?.is_propeleri
              ? form.shootout_winner === "team_a" ? "team" : "opponent"
              : form.shootout_winner === "team_b" ? "team" : "opponent"
            : undefined
        }
        variant="compact"
      />

      <Tabs defaultValue="match" className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
          <TabsTrigger value="match">{tt("matchAndTime")}</TabsTrigger>
          {isTournamentMatch && (
            <TabsTrigger value="roster">{tt("roster")}</TabsTrigger>
          )}
          <TabsTrigger value="lineup">{tt("lineup")}</TabsTrigger>
          <TabsTrigger value="goals">{tg("goalsAndAssists")}</TabsTrigger>
        </TabsList>

        <TabsContent value="match" className="space-y-4 max-w-4xl mx-auto">
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
                            .filter(t => !t.is_propeleri)
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

                  <div className="space-y-2">
                    <Label>{tg("youtubeUrl")}</Label>
                    <Input
                      value={game.youtube_url || ""}
                      onChange={(e) => setGame({ ...game, youtube_url: e.target.value || null })}
                      placeholder={tg("youtubeUrlPlaceholder")}
                      type="url"
                    />
                    {game.youtube_url && !isValidYouTubeUrl(game.youtube_url) && (
                      <p className="text-xs text-destructive">{tg("youtubeUrlInvalid")}</p>
                    )}
                  </div>

                  <SlugField
                    value={game.slug}
                    onChange={(slug) => setGame({ ...game, slug })}
                    onRegenerate={() => {
                      const opponent = teams.find(t => t.id === game.opponent_team_id);
                      setGame((prev) =>
                        prev
                          ? {
                              ...prev,
                              slug: buildGameSlug({
                                gameDate: prev.game_date,
                                opponentName: opponent?.name ?? "",
                                isHome: prev.is_home,
                                tournamentName: tournament?.name,
                              }),
                            }
                          : prev
                      );
                    }}
                    table="games"
                    excludeId={gameId}
                    baseUrl="/games"
                  />

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
                // Турнирный матч — объединённая вкладка (матч + соперники)
                <>
                  {/* Team selectors */}
                  <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] items-end">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{tt("selectTeamA")}</Label>
                      <Select
                        value={form.team_a_id || "__none__"}
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
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder={tt("selectTeam")} />
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
                      size="icon"
                      className="h-9 w-9"
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
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{tt("selectTeamB")}</Label>
                      <Select
                        value={form.team_b_id || "__none__"}
                        onValueChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            team_b_id: value === "__none__" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder={tt("selectTeam")} />
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

                  {/* Visual scoreboard */}
                  <div className="flex items-center justify-center gap-4 sm:gap-6 py-4">
                    <div className="flex flex-col items-center gap-2 min-w-0">
                      <TeamAvatar
                        name={selectedTeamA?.name ?? tt("teamA")}
                        logoUrl={selectedTeamA?.logo_url}
                        country={selectedTeamA?.country}
                        size="md"
                      />
                      <p className="text-sm font-medium truncate max-w-[120px] text-center">
                        {selectedTeamA?.name ?? tt("teamA")}
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            value={form.score_a}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                score_a: parseInt(event.target.value, 10) || 0,
                              }))
                            }
                            className="w-16 h-14 text-center text-2xl font-bold bg-background/50 border-2 focus-visible:ring-primary/50"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant={form.shootout_winner === "team_a" ? "default" : "outline"}
                            className={`text-[10px] h-6 px-2 ${form.shootout_winner === "team_a" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                            disabled={form.shootout_winner === null && form.score_a !== form.score_b}
                            onClick={() =>
                              setForm((prev) => {
                                if (prev.shootout_winner === "team_a") {
                                  return { ...prev, shootout_winner: null, score_a: Math.max(0, prev.score_a - 1) };
                                }
                                const wasB = prev.shootout_winner === "team_b";
                                return {
                                  ...prev,
                                  shootout_winner: "team_a",
                                  score_a: prev.score_a + 1,
                                  score_b: wasB ? Math.max(0, prev.score_b - 1) : prev.score_b,
                                };
                              })
                            }
                          >
                            {tt("shootoutShort")}
                          </Button>
                        </div>
                        <span className="text-xl font-bold text-muted-foreground mb-6">:</span>
                        <div className="flex flex-col items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            value={form.score_b}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                score_b: parseInt(event.target.value, 10) || 0,
                              }))
                            }
                            className="w-16 h-14 text-center text-2xl font-bold bg-background/50 border-2 focus-visible:ring-primary/50"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant={form.shootout_winner === "team_b" ? "default" : "outline"}
                            className={`text-[10px] h-6 px-2 ${form.shootout_winner === "team_b" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                            disabled={form.shootout_winner === null && form.score_a !== form.score_b}
                            onClick={() =>
                              setForm((prev) => {
                                if (prev.shootout_winner === "team_b") {
                                  return { ...prev, shootout_winner: null, score_b: Math.max(0, prev.score_b - 1) };
                                }
                                const wasA = prev.shootout_winner === "team_a";
                                return {
                                  ...prev,
                                  shootout_winner: "team_b",
                                  score_b: prev.score_b + 1,
                                  score_a: wasA ? Math.max(0, prev.score_a - 1) : prev.score_a,
                                };
                              })
                            }
                          >
                            {tt("shootoutShort")}
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={form.is_completed ? "default" : "outline"}
                        className={`text-xs ${form.is_completed ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, is_completed: !prev.is_completed }))
                        }
                      >
                        {form.is_completed ? (
                          <>
                            <Check className="mr-1 h-3 w-3" />
                            {tt("completed")}
                          </>
                        ) : (
                          tt("markCompleted")
                        )}
                      </Button>
                    </div>

                    <div className="flex flex-col items-center gap-2 min-w-0">
                      <TeamAvatar
                        name={selectedTeamB?.name ?? tt("teamB")}
                        logoUrl={selectedTeamB?.logo_url}
                        country={selectedTeamB?.country}
                        size="md"
                      />
                      <p className="text-sm font-medium truncate max-w-[120px] text-center">
                        {selectedTeamB?.name ?? tt("teamB")}
                      </p>
                    </div>
                  </div>

                  {/* Match metadata */}
                  <div className="border-t border-border/40 pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{tt("stage")}</Label>
                        <Select
                          value={form.stage}
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
                            onChange={(event) =>
                              setForm((prev) => ({ ...prev, bracket_label: event.target.value }))
                            }
                            placeholder={tt("labelPlaceholder")}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 mt-4">
                      <div className="space-y-2">
                        <Label>{tt("matchDate")}</Label>
                        <Input
                          type="datetime-local"
                          value={form.match_date}
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

                    <div className="space-y-2 mt-4">
                      <Label>{tg("youtubeUrl")}</Label>
                      <Input
                        value={game.youtube_url || ""}
                        onChange={(e) => setGame({ ...game, youtube_url: e.target.value || null })}
                        placeholder={tg("youtubeUrlPlaceholder")}
                        type="url"
                      />
                      {game.youtube_url && !isValidYouTubeUrl(game.youtube_url) && (
                        <p className="text-xs text-destructive">{tg("youtubeUrlInvalid")}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => void saveMatch()}
                      disabled={savingAction === "match"}
                      className="min-w-[150px]"
                    >
                      {savingAction === "match" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {tc("save")}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roster" className="space-y-4">
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
            <>
              {/* Desktop: split view — unselected buttons left, selected list right */}
              <div className="hidden md:grid md:grid-cols-[1fr_280px] gap-4">
                <div>
                  {sortedPlayers.filter((p) => !registeredSet.has(p.id)).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">{tg("allPlayersSelected")}</p>
                  ) : (
                    <div className="grid gap-2 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {sortedPlayers
                        .filter((p) => !registeredSet.has(p.id))
                        .map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => void toggleRegisteredPlayer(player.id)}
                            disabled={!isTournamentMatch || savingAction === "roster"}
                            className={`rounded-md border border-border/40 px-3 py-2 text-left transition-colors hover:border-primary/30 ${!isTournamentMatch ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <PlayerAvatar src={player.avatar_url} initials={`${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`} />
                              <div className="min-w-0">
                                <span className="text-sm font-medium truncate block leading-tight">
                                  {formatPlayerName(player)}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  #{player.jersey_number ?? "—"} · {player.position}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <Card className="border-border/40 self-start sticky top-20">
                  <CardHeader className="py-3 px-4 border-b border-border/30">
                    <CardTitle className="text-sm flex items-center justify-between">
                      {tg("selectedPlayers")}
                      <Badge variant="secondary" className="text-xs">{registeredPlayerIds.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 max-h-150 overflow-y-auto">
                    {sortedPlayers
                      .filter((p) => registeredSet.has(p.id))
                      .length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">{tg("noPlayersSelected")}</p>
                      ) : (
                        sortedPlayers
                          .filter((p) => registeredSet.has(p.id))
                          .map((player) => (
                            <button
                              key={player.id}
                              type="button"
                              onClick={() => void toggleRegisteredPlayer(player.id)}
                              disabled={!isTournamentMatch || savingAction === "roster"}
                              className="w-full flex items-center gap-2 py-2 px-3 text-left hover:bg-destructive/10 transition-colors border-b border-border/20 last:border-b-0 group"
                            >
                              <PlayerAvatar src={player.avatar_url} initials={`${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`} className="h-6 w-6" />
                              <span className="text-xs font-medium truncate flex-1">
                                {formatPlayerName(player)}
                              </span>
                              {player.position && (
                                <Badge
                                  variant="secondary"
                                  className={`text-[9px] px-1.5 py-0 shrink-0 ${POSITION_COLORS[player.position as PlayerPosition]}`}
                                >
                                  {player.position}
                                </Badge>
                              )}
                              <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-destructive shrink-0" />
                            </button>
                          ))
                      )}
                  </CardContent>
                </Card>
              </div>

              {/* Mobile: all players in one grid, selected highlighted */}
              <div className="md:hidden grid gap-2 sm:grid-cols-2">
                {sortedPlayers.map((player) => {
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
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar src={player.avatar_url} initials={`${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">
                              {formatPlayerName(player)}
                            </span>
                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            #{player.jersey_number ?? "—"} · {player.position}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="lineup" className="space-y-4">
          <GameLineupEditor
            gameId={gameId}
            embedded
            backHref={null}
            onSaved={() => void loadAll()}
          />
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{tg("goalsAndAssists")}</h2>
                <Button
                  type="button"
                  onClick={() => void saveGoals()}
                  disabled={savingAction === "goals"}
                >
                  {savingAction === "goals" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {tc("save")}
                </Button>
              </div>

              <GoalEventsEditor
                goalEvents={goalEvents}
                onGoalEventsChange={setGoalEvents}
                teamGoals={getRegulationGoals()}
                availablePlayers={goalEventPlayers}
                penaltyEvents={penaltyEvents}
                onPenaltyEventsChange={setPenaltyEvents}
                goalieReport={goalieReport}
                onGoalieReportChange={setGoalieReport}
                goalieOptions={goalEventPlayers.filter(p => p.position === "goalie")}
              />
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
