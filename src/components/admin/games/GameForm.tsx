"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type {
    Game,
    Season,
    GameResult,
    Tournament,
    Team,
    Profile,
    GameNotesPayload,
    GoalEventInput,
    GoalPeriod,
    GoaliePerformance,
    GoalieReportInput,
} from "@/types/database";
import {
    belgradeDateTimeLocalInputToUtcIso,
    utcToBelgradeDateTimeLocalInput,
    formatInBelgrade,
} from "@/lib/utils/datetime";
import { updateGameStats } from "@/lib/utils/game-stats";
import { isValidYouTubeUrl } from "@/lib/utils/youtube";
import {
    GoalEventsEditor,
    createEmptyGoalEvent as createEmpty,
    normalizeGoalEventsCount as normalizeCount,
    normalizeGoalClock,
    parseGameNotesPayload,
    formatPlayerOption,
    GOAL_PERIOD_VALUES,
} from "./GoalEventsEditor";


// --- Types ---

export type GameFormData = {
    season_id: string;
    tournament_id: string;
    opponent_team_id: string;
    location: string;
    game_date: string;
    is_home: boolean;
    home_score: number;
    away_score: number;
    result: GameResult;
    youtube_url: string;
};



interface GameFormProps {
    initialData?: Game;
    seasons: Season[];
    tournaments: Tournament[];
    teams: Team[];
    players: Profile[];
    onSave: (data: Record<string, unknown>) => Promise<void>;
    onCancel?: () => void;
    isManagedByTournament?: boolean;
}

// --- Helpers (delegated to GoalEventsEditor, re-aliased for local use) ---

const createEmptyGoalEvent = createEmpty;
const normalizeGoalEventsCount = normalizeCount;

export function GameForm({
    initialData,
    seasons,
    tournaments,

    teams,
    players,
    onSave,
    isManagedByTournament = false,
}: GameFormProps) {
    const tg = useTranslations("game");
    const tt = useTranslations("tournament");
    const tc = useTranslations("common");
    const ta = useTranslations("admin");

    const supabase = useMemo(() => createClient(), []);

    // -- State --
    const [form, setForm] = useState<GameFormData>({
        season_id: initialData?.season_id ?? seasons[0]?.id ?? "",
        tournament_id: initialData?.tournament_id ?? "",
        opponent_team_id: initialData?.opponent_team_id ?? "",
        location: initialData?.location ?? "",
        game_date: initialData
            ? utcToBelgradeDateTimeLocalInput(initialData.game_date)
            : "",
        is_home: initialData?.is_home ?? true,
        home_score: initialData?.home_score ?? 0,
        away_score: initialData?.away_score ?? 0,
        result: initialData?.result ?? "pending",
        youtube_url: initialData?.youtube_url ?? "",
    });

    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [lineupPlayers, setLineupPlayers] = useState<Profile[]>([]);
    const [lineupLoading, setLineupLoading] = useState(false);

    const [goalEvents, setGoalEvents] = useState<GoalEventInput[]>([]);
    const [goalieReport, setGoalieReport] = useState<GoalieReportInput>({
        goalie_player_id: "",
        performance: "average",
    });

    // -- Derived State --
    const teamGoals = Math.max(
        0,
        initialData ? (form.is_home ? form.home_score : form.away_score) : 0
    );

    const availablePlayers = useMemo(
        () =>
            (lineupPlayers.length > 0 ? lineupPlayers : players).slice().sort((a, b) => {
                const aNumber = a.jersey_number ?? 999;
                const bNumber = b.jersey_number ?? 999;
                if (aNumber !== bNumber) return aNumber - bNumber;
                return `${a.first_name} ${a.last_name}`.localeCompare(
                    `${b.first_name} ${b.last_name}`
                );
            }),
        [lineupPlayers, players]
    );

    const goalieOptions = useMemo(
        () => availablePlayers.filter((player) => player.position === "goalie"),
        [availablePlayers]
    );

    // -- Effects --
    useEffect(() => {
        if (initialData) {
            setForm(prev => ({
                ...prev,
                opponent_team_id: initialData.opponent_team_id ?? "",
                location: initialData.location ?? "",
            }));

            // Parse notes
            const parsedNotes = parseGameNotesPayload(initialData.notes);
            const parsedGoalEvents = parsedNotes?.goal_events ?? [];
            const propeleriGoals = initialData.is_home ? initialData.home_score : initialData.away_score;

            setGoalEvents(normalizeGoalEventsCount(parsedGoalEvents, propeleriGoals));
            setGoalieReport(
                parsedNotes?.goalie_report ?? {
                    goalie_player_id: "",
                    performance: "average",
                }
            );

            // Load lineup
            loadLineupPlayers(initialData.id);
        }
    }, [initialData]); // eslint-disable-line react-hooks/exhaustive-deps

    // -- Callbacks --

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

    async function handleSubmit() {
        setSaving(true);
        setError("");

        try {
            // 1. Prepare Notes
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

            // 2. Prepare Opponent
            if (!form.opponent_team_id) {
                throw new Error(tg("errorOpponentRequired"));
            }
            const opponentTeam = teams.find(t => t.id === form.opponent_team_id);
            if (!opponentTeam) {
                throw new Error(tg("errorOpponentNotFound"));
            }

            // 3. Prepare Date
            const gameDateUtc = belgradeDateTimeLocalInputToUtcIso(form.game_date);
            if (!gameDateUtc) {
                throw new Error(tg("errorInvalidGameDate"));
            }

            // 4. Construct Payload
            const payload: Record<string, unknown> = {
                season_id: form.season_id,
                tournament_id: form.tournament_id || null,
                opponent_team_id: opponentTeam.id,
                location: form.location || null,
                game_date: gameDateUtc,
                is_home: form.is_home,
                home_score: form.home_score,
                away_score: form.away_score,
                result: form.result,
                notes: notesValue,
                youtube_url: form.youtube_url.trim() || null,
            };

            // 5. Call onSave
            await onSave(payload);

            // 6. Handle Stats (if editing)
            if (initialData) {
                await updateGameStats(supabase, initialData.id, notesValue);
            }

        } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : tg("errorSaving"));
        } finally {
            setSaving(false);
        }
    }

    const selectedOpponentId = form.opponent_team_id;

    // Historical games for context
    const [opponentHistory, setOpponentHistory] = useState<Game[]>([]);
    useEffect(() => {
        if (!selectedOpponentId) {
            setOpponentHistory([]);
            return;
        }

        // We shouldn't fetch inside component ideally if we want it pure, but functionality was there.
        // Let's just do a quick fetch
        const fetchHistory = async () => {
            const { data } = await supabase
                .from("games")
                .select("*")
                .eq("opponent_team_id", selectedOpponentId)
                .neq("id", initialData?.id ?? "__new__")
                .order("game_date", { ascending: false })
                .limit(6);
            if (data) setOpponentHistory(data);
        };
        fetchHistory();
    }, [selectedOpponentId, initialData, supabase]);

    return (
        <div className="space-y-4">
            {isManagedByTournament && (
                <Badge className="bg-yellow-500/20 text-yellow-400">
                    {tt("managedByTournament")}
                </Badge>
            )}

            <div className="space-y-2">
                <Label>{ta("season")}</Label>
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
                    value={form.opponent_team_id || "__none__"}
                    onValueChange={(v) => {
                        setForm({ ...form, opponent_team_id: v === "__none__" ? "" : v });
                    }}
                    disabled={isManagedByTournament}
                >
                    <SelectTrigger className="bg-background">
                        <SelectValue placeholder={tt("selectOpponent")} />
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



            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>{ta("dateAndTime")}</Label>
                    <Input
                        type="datetime-local"
                        value={form.game_date}
                        onChange={(e) => setForm({ ...form, game_date: e.target.value })}
                        className="bg-background"
                        disabled={isManagedByTournament}
                    />
                </div>
                <div className="space-y-2">
                    <Label>{ta("location")}</Label>
                    <Input
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className="bg-background"
                        disabled={isManagedByTournament}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>{tg("youtubeUrl")}</Label>
                <Input
                    value={form.youtube_url}
                    onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
                    placeholder={tg("youtubeUrlPlaceholder")}
                    className="bg-background"
                    type="url"
                />
                {form.youtube_url && !isValidYouTubeUrl(form.youtube_url) && (
                    <p className="text-xs text-destructive">{tg("youtubeUrlInvalid")}</p>
                )}
            </div>

            {initialData && !isManagedByTournament && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>{ta("homeScore")}</Label>
                        <Input
                            type="number"
                            value={form.home_score}
                            onChange={(e) => {
                                const nextHomeScore = parseInt(e.target.value, 10) || 0;
                                setForm({
                                    ...form,
                                    home_score: nextHomeScore,
                                });
                                if (initialData) {
                                    const nextTeamGoals = form.is_home ? nextHomeScore : form.away_score;
                                    setGoalEvents((prev) => normalizeGoalEventsCount(prev, nextTeamGoals));
                                }
                            }}
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{ta("awayScore")}</Label>
                        <Input
                            type="number"
                            value={form.away_score}
                            onChange={(e) => {
                                const nextAwayScore = parseInt(e.target.value, 10) || 0;
                                setForm({
                                    ...form,
                                    away_score: nextAwayScore,
                                });
                                if (initialData) {
                                    const nextTeamGoals = form.is_home ? form.home_score : nextAwayScore;
                                    setGoalEvents((prev) => normalizeGoalEventsCount(prev, nextTeamGoals));
                                }
                            }}
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{ta("result")}</Label>
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

            {initialData && !isManagedByTournament && (
                <div className="space-y-4 rounded-md border border-border/50 p-4 bg-background/40">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold">{tg("goalsAndAssists")}</p>
                            <p className="text-xs text-muted-foreground">
                                {tg("needMoreGoals", {
                                    count: teamGoals,
                                    goalWord: teamGoals === 1 ? tg("goalWord") : tg("goalWordPlural")
                                })}
                            </p>
                        </div>
                        {lineupLoading && (
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {tg("loadingLineup")}
                            </span>
                        )}
                    </div>

                    <GoalEventsEditor
                        goalEvents={goalEvents}
                        onGoalEventsChange={setGoalEvents}
                        teamGoals={teamGoals}
                        availablePlayers={availablePlayers}
                        goalieReport={goalieReport}
                        onGoalieReportChange={setGoalieReport}
                        goalieOptions={goalieOptions}
                    />
                </div>
            )}

            {opponentHistory.length > 0 && (
                <div className="space-y-2">
                    <Label>{tt("opponentHistory")}</Label>
                    <div className="space-y-1 rounded-md border border-border/40 p-2">
                        {opponentHistory.map((game) => (
                            <div
                                key={game.id}
                                className="text-xs text-muted-foreground flex items-center justify-between"
                            >
                                <span>
                                    {formatInBelgrade(game.game_date, "sr", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric"
                                    })}
                                </span>
                                <span className="font-medium text-foreground">
                                    {game.is_home ? game.home_score : game.away_score} :{" "}
                                    {game.is_home ? game.away_score : game.home_score}
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
                    onClick={handleSubmit}
                    disabled={
                        saving || (!isManagedByTournament && (!form.game_date || !form.opponent_team_id))
                    }
                    className="flex-1 bg-primary"
                >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tc("save")}
                </Button>
            </div>
        </div>
    );
}
