
import { SupabaseClient } from "@supabase/supabase-js";
import type { GameNotesPayload, GoalEventInput, PenaltyEventInput, GameStats } from "@/types/database";

export async function updateGameStats(
    supabase: SupabaseClient,
    gameId: string,
    notesJson: string | null
) {
    if (!notesJson) return;

    let goalEvents: GoalEventInput[] = [];
    let penaltyEvents: PenaltyEventInput[] = [];
    try {
        const parsed = JSON.parse(notesJson) as GameNotesPayload;
        if (parsed && Array.isArray(parsed.goal_events)) {
            goalEvents = parsed.goal_events;
        }
        if (parsed && Array.isArray(parsed.penalty_events)) {
            penaltyEvents = parsed.penalty_events;
        }
    } catch (e) {
        console.error("Failed to parse game notes for stats update", e);
        return;
    }

    const goalsByPlayer = new Map<string, number>();
    const assistsByPlayer = new Map<string, number>();
    const penaltiesByPlayer = new Map<string, number>();

    for (const event of goalEvents) {
        if (event.scorer_player_id) {
            goalsByPlayer.set(
                event.scorer_player_id,
                (goalsByPlayer.get(event.scorer_player_id) ?? 0) + 1
            );
        }
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

    for (const event of penaltyEvents) {
        if (event.player_id) {
            penaltiesByPlayer.set(
                event.player_id,
                (penaltiesByPlayer.get(event.player_id) ?? 0) + event.minutes
            );
        }
    }

    // Fetch existing stats to handle deletions of rows no longer referenced
    const { data: existingStats, error: existingStatsError } = await supabase
        .from("game_stats")
        .select("player_id")
        .eq("game_id", gameId);

    if (existingStatsError) throw existingStatsError;

    const existingPlayerIds = new Set(
        (existingStats ?? []).map((stat) => stat.player_id as string)
    );

    const candidatePlayerIds = new Set<string>([
        ...existingPlayerIds,
        ...goalsByPlayer.keys(),
        ...assistsByPlayer.keys(),
        ...penaltiesByPlayer.keys(),
    ]);

    const rowsToUpsert: Partial<GameStats>[] = [];
    const playerIdsToDelete: string[] = [];

    for (const playerId of candidatePlayerIds) {
        const goals = goalsByPlayer.get(playerId) ?? 0;
        const assists = assistsByPlayer.get(playerId) ?? 0;
        const penaltyMinutes = penaltiesByPlayer.get(playerId) ?? 0;

        if (goals === 0 && assists === 0 && penaltyMinutes === 0) {
            playerIdsToDelete.push(playerId);
            continue;
        }

        rowsToUpsert.push({
            game_id: gameId,
            player_id: playerId,
            goals,
            assists,
            penalty_minutes: penaltyMinutes,
            plus_minus: 0,
        });
    }

    if (rowsToUpsert.length > 0) {
        const { error } = await supabase
            .from("game_stats")
            .upsert(rowsToUpsert, { onConflict: "game_id,player_id" });
        if (error) throw error;
    }

    if (playerIdsToDelete.length > 0) {
        const { error } = await supabase
            .from("game_stats")
            .delete()
            .eq("game_id", gameId)
            .in("player_id", playerIdsToDelete);
        if (error) throw error;
    }
}
