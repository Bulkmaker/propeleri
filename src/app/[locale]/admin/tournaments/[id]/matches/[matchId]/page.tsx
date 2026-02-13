"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link, useRouter } from "@/i18n/navigation";
import { TeamAvatar } from "@/components/matches/TeamAvatar";
import dynamic from "next/dynamic";
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
  buildTournamentMatchUrlParam,
  parseTournamentMatchUrlParam,
} from "@/lib/utils/match-slug";
import {
  belgradeDateTimeLocalInputToUtcIso,
  utcToBelgradeDateTimeLocalInput,
} from "@/lib/utils/datetime";
import { formatPlayerName } from "@/lib/utils/player-name";
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
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
  TournamentTeam,
} from "@/types/database";

const GameLineupEditor = dynamic(
  () => import("@/components/games/GameLineupEditor").then((m) => m.GameLineupEditor),
  { loading: () => <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> }
);

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

export default function TournamentMatchEditorPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  const rawMatchParam = params.matchId as string;
  const matchId = useMemo(() => parseTournamentMatchUrlParam(rawMatchParam), [rawMatchParam]);

  const tt = useTranslations("tournament");
  const tc = useTranslations("common");
  const ts = useTranslations("stats");

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
    // Do not set loading(true) here to avoid unmounting Tabs and resetting state
    // setLoading(true);

    const [
      tournamentRes,
      matchRes,
      junctionsRes,
      allTeamsRes,
      groupsRes,
      groupTeamsRes,
      playersRes,
      registrationsRes,
    ] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
      supabase.from("tournament_matches").select("*").eq("id", matchId).maybeSingle(),
      supabase
        .from("tournament_teams")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("sort_order"),
      supabase.from("teams").select("*").order("name"),
      supabase
        .from("tournament_groups")
        .select("*")
        .eq("tournament_id", tournamentId)
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
        .eq("tournament_id", tournamentId),
    ]);

    const loadedTournament = (tournamentRes.data ?? null) as Tournament | null;
    const loadedMatch = (matchRes.data ?? null) as TournamentMatch | null;

    if (!loadedTournament || !loadedMatch || loadedMatch.tournament_id !== tournamentId) {
      setTournament(loadedTournament);
      setMatch(null);
      setGame(null);
      setTeams([]);
      setGroups([]);
      setGroupTeams([]);
      setPlayers([]);
      setRegisteredPlayerIds([]);
      setStatsRows([]);
      setError(tt("matchNotFound"));
      setLoading(false);
      return;
    }

    // Redirect Propeleri matches to the unified game editor
    if (loadedMatch.game_id) {
      router.replace(`/admin/games/${loadedMatch.game_id}`);
      return;
    }

    const allTeams = (allTeamsRes.data ?? []) as Team[];
    const tournamentTeams = (junctionsRes.data ?? []) as TournamentTeam[];
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

    setTournament(loadedTournament);
    setMatch(loadedMatch);
    setTeams(loadedTeams);
    setGroups(loadedGroups);
    setGroupTeams(loadedGroupTeams);
    setPlayers(loadedPlayers);
    setRegisteredPlayerIds(loadedRegistrations);

    setForm({
      team_a_id: loadedMatch.team_a_id ?? "",
      team_b_id: loadedMatch.team_b_id ?? "",
      stage: loadedMatch.stage,
      group_id: loadedMatch.group_id ?? "",
      match_date: toDateTimeLocalInput(loadedMatch.match_date),
      bracket_label: loadedMatch.bracket_label ?? "",
      score_a: loadedMatch.score_a,
      score_b: loadedMatch.score_b,
      is_completed: loadedMatch.is_completed,
    });

    if (!loadedMatch.game_id) {
      setGame(null);
      setStatsRows([]);
      setLoading(false);
      return;
    }

    const [gameRes, lineupRes, statsRes] = await Promise.all([
      supabase.from("games").select("*").eq("id", loadedMatch.game_id).maybeSingle(),
      supabase
        .from("game_lineups")
        .select("player_id, designation, line_number, slot_position, player:profiles(first_name, last_name, jersey_number)")
        .eq("game_id", loadedMatch.game_id)
        .order("line_number", { ascending: true })
        .order("slot_position", { ascending: true }),
      supabase
        .from("game_stats")
        .select("player_id, goals, assists, penalty_minutes, plus_minus, player:profiles(first_name, last_name, jersey_number)")
        .eq("game_id", loadedMatch.game_id),
    ]);

    const loadedGame = (gameRes.data ?? null) as Game | null;
    const lineupData = (lineupRes.data ?? []) as LineupRowRecord[];
    const statsData = (statsRes.data ?? []) as StatsRowRecord[];

    setGame(loadedGame);

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
  }, [matchId, supabase, tournamentId, tc, tt]);

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

  const resolveOpponentName = useCallback(
    (teamAId: string | null, teamBId: string | null): string => {
      const teamA = teamAId ? teamById.get(teamAId) : undefined;
      const teamB = teamBId ? teamById.get(teamBId) : undefined;

      if (teamA?.is_propeleri && teamB?.name) return teamB.name;
      if (teamB?.is_propeleri && teamA?.name) return teamA.name;
      return teamB?.name ?? teamA?.name ?? "opponent";
    },
    [teamById]
  );

  useEffect(() => {
    if (!match || !tournament) return;

    const desiredParam = buildTournamentMatchUrlParam({
      matchId: match.id,
      matchDate: match.match_date,
      opponentName: resolveOpponentName(match.team_a_id, match.team_b_id),
      tournamentName: tournament.name,
      stage: match.stage,
    });

    if (desiredParam === rawMatchParam) return;

    router.replace(`/admin/tournaments/${tournamentId}/matches/${desiredParam}`);
  }, [match, rawMatchParam, resolveOpponentName, router, tournament, tournamentId]);

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
    if (!match?.game_id) {
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
      .eq("game_id", match.game_id);

    if (deleteError) {
      setError(deleteError.message);
      setSavingAction(null);
      return;
    }

    const payload = statsRows.map((row) => ({
      game_id: match.game_id as string,
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament || !match) {
    return <div className="p-6 text-center text-muted-foreground">{tt("matchNotFound")}</div>;
  }

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href={`/admin/tournaments/${tournament.id}`}>
            <Button size="icon" variant="ghost">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{tournament.name}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {teamById.get(form.team_a_id)?.name ?? "TBD"} vs{" "}
              {teamById.get(form.team_b_id)?.name ?? "TBD"}
            </p>
          </div>

          {match.game_id && (
            <div className="ml-auto">
              <Link href={`/admin/games/${match.game_id}`}>
                <Button variant="outline" size="sm">
                  {tt("details")}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
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

        <Tabs defaultValue="match" className="w-full">
          <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
            <TabsTrigger value="match">{tt("matchAndTime")}</TabsTrigger>

            <TabsTrigger value="roster">{tt("roster")}</TabsTrigger>
            <TabsTrigger value="lineup">{tt("lineup")}</TabsTrigger>
            <TabsTrigger value="stats">{tt("statistics")}</TabsTrigger>
          </TabsList>

          <TabsContent value="match" className="space-y-4">
            {/* Scoreboard Section */}
            <Card className="border-border/40">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                  {/* Team A */}
                  <div className="flex-1 flex flex-col items-center gap-3 text-center min-w-0 w-full">
                    <TeamAvatar
                      name={selectedTeamA?.name ?? tt("teamA")}
                      logoUrl={selectedTeamA?.logo_url}
                      country={selectedTeamA?.country}
                      size="lg" // Assuming lg size exists or will default to something reasonable, if not I might need to check TeamAvatar definition. Checking file... actually TeamAvatar usually takes sm/md/lg. I'll check if lg is valid or use className.
                      className="h-20 w-20 md:h-24 md:w-24 text-2xl"
                    />
                    <div className="space-y-1 w-full">
                      <p className="font-bold text-lg truncate w-full">
                        {selectedTeamA?.name ?? tc("notSelected")}
                      </p>
                      {selectedTeamA?.is_propeleri && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                          {tt("propeleri")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Score & Status */}
                  <div className="flex flex-col items-center gap-4 shrink-0">
                    <div className="flex items-center gap-4">
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
                        className="w-20 h-16 text-center text-3xl font-bold bg-background/50 border-2 focus-visible:ring-primary/50"
                      />
                      <span className="text-2xl font-bold text-muted-foreground">-</span>
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
                        className="w-20 h-16 text-center text-3xl font-bold bg-background/50 border-2 focus-visible:ring-primary/50"
                      />
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant={form.is_completed ? "default" : "outline"}
                      className={`min-w-[120px] ${form.is_completed ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                      onClick={() =>
                        setForm((prev) => ({ ...prev, is_completed: !prev.is_completed }))
                      }
                    >
                      {form.is_completed ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          {tt("completed")}
                        </>
                      ) : (
                        tt("markCompleted")
                      )}
                    </Button>
                  </div>

                  {/* Team B */}
                  <div className="flex-1 flex flex-col items-center gap-3 text-center min-w-0 w-full">
                    <TeamAvatar
                      name={selectedTeamB?.name ?? tt("teamB")}
                      logoUrl={selectedTeamB?.logo_url}
                      country={selectedTeamB?.country}
                      size="lg"
                      className="h-20 w-20 md:h-24 md:w-24 text-2xl"
                    />
                    <div className="space-y-1 w-full">
                      <p className="font-bold text-lg truncate w-full">
                        {selectedTeamB?.name ?? tc("notSelected")}
                      </p>
                      {selectedTeamB?.is_propeleri && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                          {tt("propeleri")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Team Selectors (Collapsible or just reduced prominence) */}
                <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-border/40">
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
              </CardContent>
            </Card>

            {/* Match Metadata */}
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground">{tt("matchDetails")}</h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                            // Logic preserved from original
                            if (!nextGroupId) return { ...prev, group_id: "" };

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
                            if (teamAId && teamBId && teamAId === teamBId) teamBId = "";

                            return { ...prev, group_id: nextGroupId, team_a_id: teamAId, team_b_id: teamBId };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>{tt("label")}</Label>
                      <Input
                        value={form.bracket_label}
                        onChange={(e) => setForm((prev) => ({ ...prev, bracket_label: e.target.value }))}
                        placeholder={tt("labelPlaceholder")}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>{tt("matchDate")}</Label>
                    <Input
                      type="datetime-local"
                      value={form.match_date}
                      onChange={(e) => setForm((prev) => ({ ...prev, match_date: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{tt("location")}</Label>
                    <Input
                      value={tournament.location ?? ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={() => void saveMatch()} disabled={savingAction === "match"} className="min-w-[150px]">
                    {savingAction === "match" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {tc("saveChanges")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="roster" className="space-y-4">
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-4">
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
                          disabled={savingAction === "roster"}
                          className={`rounded-md border px-3 py-2 text-left transition-colors ${isSelected
                            ? "border-primary/50 bg-primary/10"
                            : "border-border/40 hover:border-primary/30"
                            }`}
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
            {!match.game_id ? (
              <Card className="border-border/40">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  {tt("noLinkedGame")}
                </CardContent>
              </Card>
            ) : (
              <GameLineupEditor
                gameId={match.game_id}
                embedded
                backHref={null}
                onSaved={() => {
                  void loadAll();
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            {!match.game_id ? (
              <Card className="border-border/40">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  {tt("noStatsGame")}
                </CardContent>
              </Card>
            ) : (
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
            )}
          </TabsContent>
        </Tabs>

        {game?.location && (
          <p className="text-xs text-muted-foreground">
            {tt("gameLocation", { location: game.location })}
          </p>
        )}
      </div>
    </div>
  );
}
