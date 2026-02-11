"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Loader2, Save } from "lucide-react";
import type { Profile, GameStats } from "@/types/database";

interface PlayerStatRow {
  player_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  goals: number;
  assists: number;
  penalty_minutes: number;
  plus_minus: number;
}

interface GameLineupEntry {
  player_id: string;
  player:
    | Pick<Profile, "first_name" | "last_name" | "jersey_number">
    | Pick<Profile, "first_name" | "last_name" | "jersey_number">[]
    | null;
}

export default function GameStatsEntryPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const tc = useTranslations("common");
  const ts = useTranslations("stats");

  const [rows, setRows] = useState<PlayerStatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      // Get lineup players
      const { data: lineup } = await supabase
        .from("game_lineups")
        .select("player_id, player:profiles(first_name, last_name, jersey_number)")
        .eq("game_id", gameId);

      // Get existing stats
      const { data: existingStats } = await supabase
        .from("game_stats")
        .select("*")
        .eq("game_id", gameId);

      const statsMap = new Map(
        (existingStats ?? []).map((s: GameStats) => [s.player_id, s])
      );

      const playerRows: PlayerStatRow[] = ((lineup ?? []) as GameLineupEntry[]).map((entry) => {
        const player = Array.isArray(entry.player) ? entry.player[0] : entry.player;
        const existing = statsMap.get(entry.player_id);
        return {
          player_id: entry.player_id,
          first_name: player?.first_name ?? "",
          last_name: player?.last_name ?? "",
          jersey_number: player?.jersey_number ?? null,
          goals: existing?.goals ?? 0,
          assists: existing?.assists ?? 0,
          penalty_minutes: existing?.penalty_minutes ?? 0,
          plus_minus: existing?.plus_minus ?? 0,
        };
      });

      setRows(playerRows);
      setLoading(false);
    }
    load();
  }, [gameId, supabase]);

  function updateRow(idx: number, field: string, value: number) {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    for (const row of rows) {
      await supabase.from("game_stats").upsert(
        {
          game_id: gameId,
          player_id: row.player_id,
          goals: row.goals,
          assists: row.assists,
          penalty_minutes: row.penalty_minutes,
          plus_minus: row.plus_minus,
        },
        { onConflict: "game_id,player_id" }
      );
    }

    setMessage("Statistika sacuvana!");
    setSaving(false);
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
          href="/admin/games"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {tc("back")}
        </Link>
        <h1 className="text-2xl font-bold">Unos statistike za utakmicu</h1>
      </div>

      <div className="p-6">
      {rows.length === 0 ? (
        <Card className="border-border/40">
          <CardContent className="p-6 text-center text-muted-foreground">
            Prvo izaberite postavu za ovu utakmicu
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">Igrac</th>
                    <th className="text-center py-2 px-2">{ts("goals")}</th>
                    <th className="text-center py-2 px-2">{ts("assists")}</th>
                    <th className="text-center py-2 px-2">{ts("penaltyMinutes")}</th>
                    <th className="text-center py-2 px-2">{ts("plusMinus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.player_id} className="border-b border-border/50">
                      <td className="py-2 px-2 text-primary font-bold">
                        {row.jersey_number ?? "-"}
                      </td>
                      <td className="py-2 px-2 font-medium">
                        {row.first_name} {row.last_name}
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min={0}
                          value={row.goals}
                          onChange={(e) =>
                            updateRow(idx, "goals", parseInt(e.target.value) || 0)
                          }
                          className="w-16 h-8 text-center bg-background mx-auto"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min={0}
                          value={row.assists}
                          onChange={(e) =>
                            updateRow(idx, "assists", parseInt(e.target.value) || 0)
                          }
                          className="w-16 h-8 text-center bg-background mx-auto"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min={0}
                          value={row.penalty_minutes}
                          onChange={(e) =>
                            updateRow(
                              idx,
                              "penalty_minutes",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 h-8 text-center bg-background mx-auto"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={row.plus_minus}
                          onChange={(e) =>
                            updateRow(
                              idx,
                              "plus_minus",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 h-8 text-center bg-background mx-auto"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {message && (
              <p className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2 mt-4">
                {message}
              </p>
            )}

            <Button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 bg-primary"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {tc("save")}
            </Button>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
