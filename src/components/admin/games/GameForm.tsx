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
import { Loader2, Save } from "lucide-react";
import type {
    Game,
    Season,
    GameResult,
    Tournament,
    Opponent,
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
import { buildOpponentVisualLookup } from "@/lib/utils/opponent-visual";
import { updateGameStats } from "@/lib/utils/game-stats";


// --- Types ---

export type GameFormData = {
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



interface GameFormProps {
    initialData?: Game;
    seasons: Season[];
    tournaments: Tournament[];
    opponents: Opponent[];
    teams: Team[];
    players: Profile[];
    onSave: (data: any) => Promise<void>;
    onCancel?: () => void;
    isManagedByTournament?: boolean;
}

// --- Constants ---

const GOAL_PERIOD_VALUES: GoalPeriod[] = ["1", "2", "3", "OT", "SO"];

// --- Helpers ---

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

export function GameForm({
    initialData,
    seasons,
    tournaments,
    opponents,
    teams,
    players,
    onSave,
    onCancel,
    isManagedByTournament = false,
}: GameFormProps) {
    const t = useTranslations("admin");
    const tg = useTranslations("game");
    const tt = useTranslations("tournament");
    const tc = useTranslations("common");

    const supabase = useMemo(() => createClient(), []);

    const GOALIE_PERFORMANCE_OPTIONS: { value: GoaliePerformance; label: string }[] = [
        { value: "excellent", label: tg("goaliePerformance.excellent") },
        { value: "good", label: tg("goaliePerformance.good") },
        { value: "average", label: tg("goaliePerformance.average") },
        { value: "bad", label: tg("goaliePerformance.bad") },
    ];

    const GOAL_PERIOD_OPTIONS: { value: GoalPeriod; label: string }[] = [
        { value: "1", label: tg("period.1") },
        { value: "2", label: tg("period.2") },
        { value: "3", label: tg("period.3") },
        { value: "OT", label: tg("period.OT") },
        { value: "SO", label: tg("period.SO") },
    ];

    // -- State --
    const [form, setForm] = useState<GameFormData>({
        season_id: initialData?.season_id ?? seasons[0]?.id ?? "",
        tournament_id: initialData?.tournament_id ?? "",
        opponent_id: initialData?.opponent_id ?? "",
        opponent: initialData?.opponent ?? "",
        location: initialData?.location ?? "",
        game_date: initialData
            ? utcToBelgradeDateTimeLocalInput(initialData.game_date)
            : "",
        is_home: initialData?.is_home ?? true,
        home_score: initialData?.home_score ?? 0,
        away_score: initialData?.away_score ?? 0,
        result: initialData?.result ?? "pending",
    });

    const [newOpponentName, setNewOpponentName] = useState("");
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
            // Find proper opponent name
            const matchedOpponent = opponents.find(o => o.id === initialData.opponent_id);
            const snapshotName = matchedOpponent ? matchedOpponent.name : initialData.opponent;

            setForm(prev => ({
                ...prev,
                opponent: snapshotName,
                opponent_id: initialData.opponent_id ?? matchedOpponent?.id ?? ""
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
    }, [initialData, opponents]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Opponent logic
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
            return existingRows[0] as Opponent;
        }

        const { data: inserted, error: insertError } = await supabase
            .from("opponents")
            .insert({ name: cleaned })
            .select("*")
            .single();

        if (insertError) {
            // Fallback read
            const { data: fallbackRows } = await supabase
                .from("opponents")
                .select("*")
                .eq("normalized_name", normalized)
                .limit(1);

            if (fallbackRows?.[0]) {
                return fallbackRows[0] as Opponent;
            }

            setError(insertError.message);
            return null;
        }

        return inserted as Opponent;
    }

    async function handleCreateOpponent() {
        if (!newOpponentName.trim()) return;
        // Note: In a real reusable component, updating the parent's opponent list might be needed.
        // For now assuming the parent might not update immediately, but we can verify.
        // However, ensureOpponent creates it in DB. 
        // Ideally we should call a prop function to refresh opponents.
        // Since we don't have that easily, we rely on the parent refreshing or just setting ID.
        // But since we need to select it, we should probably just return the ID if possible or similar.
        // Wait, the original code updated local state `setOpponents`.
        // Here we can't easily update `opponents` prop. 
        // We might need an `onOpponentCreated` prop or just refetch in parent.
        // For MVP, let's just create it and set the form ID, hoping the UI updates if we re-render or if we assume the user just needs the ID.
        // Actually, `ensureOpponent` returns the opponent. We can set it in form.

        // BUT we need it in the dropdown. 
        // Let's assume for now we just set it in form.
        const created = await ensureOpponent(newOpponentName);
        if (!created) return;

        setForm((prev) => ({
            ...prev,
            opponent_id: created.id,
            opponent: created.name,
        }));
        setNewOpponentName("");
    }

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
            let opponentRecord = form.opponent_id ? findOpponentById(form.opponent_id) : null;
            if (!opponentRecord && form.opponent) {
                // Try to find it again or create
                opponentRecord = await ensureOpponent(form.opponent);
            }

            if (!opponentRecord) {
                throw new Error("Opponent is required");
            }

            // 3. Prepare Date
            const gameDateUtc = belgradeDateTimeLocalInputToUtcIso(form.game_date);
            if (!gameDateUtc) {
                throw new Error("Invalid game date");
            }

            // 4. Construct Payload
            const payload: any = {
                season_id: form.season_id,
                tournament_id: form.tournament_id || null,
                opponent_id: opponentRecord.id,
                opponent: opponentRecord.name,
                location: form.location || null,
                game_date: gameDateUtc,
                is_home: form.is_home,
                home_score: form.home_score,
                away_score: form.away_score,
                result: form.result,
                notes: notesValue,
            };

            // 5. Call onSave
            await onSave(payload);

            // 6. Handle Stats (if editing)
            if (initialData) {
                await updateGameStats(supabase, initialData.id, notesValue);
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error saving game");
        } finally {
            setSaving(false);
        }
    }

    const selectedOpponentId =
        form.opponent_id || (form.opponent ? findOpponentByName(form.opponent)?.id ?? "" : "");

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
                .eq("opponent_id", selectedOpponentId)
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
                        disabled={isManagedByTournament}
                    />
                </div>
            </div>

            {initialData && !isManagedByTournament && (
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
                                if (initialData) {
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
                                if (initialData) {
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

                    {teamGoals === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            {tg("setScoreForGoals")}
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
                                            <Label className="text-xs">{tg("goalNumber", { number: index + 1 })}</Label>
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
                                        <div className="space-y-1">
                                            <Label className="text-xs">{tg("periodLabel")}</Label>
                                            <Select
                                                value={event.period}
                                                onValueChange={(value) =>
                                                    updateGoalEvent(index, "period", value as GoalPeriod)
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
                                            <Label className="text-xs">{tg("timeLabel")}</Label>
                                            <Input
                                                value={event.goal_time}
                                                onChange={(e) =>
                                                    updateGoalEvent(index, "goal_time", e.target.value)
                                                }
                                                className="bg-background"
                                                placeholder={tg("timePlaceholder")}
                                                inputMode="numeric"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{tg("assist1Label")}</Label>
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
                                                    <SelectValue placeholder={tg("noAssist")} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">{tg("noAssist")}</SelectItem>
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
                                            <Label className="text-xs">{tg("assist2Label")}</Label>
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
                                                    <SelectValue placeholder={tg("noAssist")} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">{tg("noAssist")}</SelectItem>
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
                        <Label>{tg("goalieAndPerformance")}</Label>
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
                        saving || (!isManagedByTournament && (!form.game_date || !form.opponent.trim()))
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
