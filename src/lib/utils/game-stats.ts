
import { SupabaseClient } from "@supabase/supabase-js";
import type { GameNotesPayload, GoalEventInput, GameStats } from "@/types/database";

export async function updateGameStats(
    supabase: SupabaseClient,
    gameId: string,
    notesJson: string | null
) {
    if (!notesJson) return;

    let goalEvents: GoalEventInput[] = [];
    try {
        const parsed = JSON.parse(notesJson) as GameNotesPayload;
        if (parsed && Array.isArray(parsed.goal_events)) {
            goalEvents = parsed.goal_events;
        }
    } catch (e) {
        console.error("Failed to parse game notes for stats update", e);
        return;
    }

    // Fetch existing stats to know what to delete/update
    // Actually easier to just calculate totals and upsert, and delete 0s
    // But we also need to preserve penalty_minutes and plus_minus if they came from elsewhere? 
    // The Admin panel previously handled goals/assists. Penalties/PlusMinus were in the same table.
    // The Logic in previous page.tsx preserved existing penalties/plus_minus.

    const { data: existingStats, error: existingStatsError } = await supabase
        .from("game_stats")
        .select("player_id, penalty_minutes, plus_minus")
        .eq("game_id", gameId);

    if (existingStatsError) throw existingStatsError;

    const goalsByPlayer = new Map<string, number>();
    const assistsByPlayer = new Map<string, number>();

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

    const existingMap = new Map(
        (existingStats ?? []).map((stat) => [stat.player_id as string, stat])
    );

    const candidatePlayerIds = new Set<string>([
        ...existingMap.keys(),
        ...goalsByPlayer.keys(),
        ...assistsByPlayer.keys(),
    ]);

    const rowsToUpsert: Partial<GameStats>[] = [];
    const playerIdsToDelete: string[] = [];

    for (const playerId of candidatePlayerIds) {
        const existing = existingMap.get(playerId);
        const goals = goalsByPlayer.get(playerId) ?? 0;
        const assists = assistsByPlayer.get(playerId) ?? 0;

        // Preserve existing other stats or default to 0
        const penaltyMinutes = Number(existing?.penalty_minutes ?? 0);
        const plusMinus = Number(existing?.plus_minus ?? 0);

        // If everything is 0, we can remove the row (unless we want to keep it for lineup purposes? 
        // Lineup is game_lineups table. game_stats is for stats.)
        if (goals === 0 && assists === 0 && penaltyMinutes === 0 && plusMinus === 0) {
            playerIdsToDelete.push(playerId);
            continue;
        }

        rowsToUpsert.push({
            game_id: gameId,
            player_id: playerId,
            goals,
            assists,
            penalty_minutes: penaltyMinutes,
            plus_minus: plusMinus,
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
