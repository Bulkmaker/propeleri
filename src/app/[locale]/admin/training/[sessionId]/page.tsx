"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, Loader2, Save, CheckCircle, XCircle, Wand2 } from "lucide-react";
import type { Profile, TrainingTeam } from "@/types/database";

interface TrainingRow {
  player_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  default_training_team: TrainingTeam | null;
  attended: boolean;
  goals: number;
  assists: number;
  training_team: TrainingTeam | null;
}

export default function TrainingStatsEntryPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const tc = useTranslations("common");
  const ts = useTranslations("stats");
  const tt = useTranslations("training");

  const [rows, setRows] = useState<TrainingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: players } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("jersey_number");

      const { data: existing } = await supabase
        .from("training_stats")
        .select("*")
        .eq("session_id", sessionId);

      const statsMap = new Map(
        (existing ?? []).map((s: any) => [s.player_id, s])
      );

      const playerRows: TrainingRow[] = (players ?? []).map((p: Profile) => {
        const e = statsMap.get(p.id);
        return {
          player_id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          jersey_number: p.jersey_number,
          default_training_team: p.default_training_team,
          attended: e?.attended ?? false,
          goals: e?.goals ?? 0,
          assists: e?.assists ?? 0,
          training_team: e?.training_team ?? null,
        };
      });

      setRows(playerRows);
      setLoading(false);
    }
    load();
  }, [sessionId]);

  function toggleAttendance(idx: number) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, attended: !row.attended } : row
      )
    );
  }

  function updateRow(idx: number, field: string, value: number) {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  }

  function setTeam(idx: number, team: TrainingTeam | null) {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, training_team: team } : row))
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

  async function handleSave() {
    setSaving(true);
    setMessage("");

    for (const row of rows) {
      await supabase.from("training_stats").upsert(
        {
          session_id: sessionId,
          player_id: row.player_id,
          attended: row.attended,
          goals: row.goals,
          assists: row.assists,
          training_team: row.training_team,
        },
        { onConflict: "session_id,player_id" }
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
      <Link
        href="/admin/training"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {tt("attendance")} & {ts("title")}
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={autoAssignTeams}
          className="border-primary/30 text-primary"
        >
          <Wand2 className="h-4 w-4 mr-2" />
          {tt("autoAssign")}
        </Button>
      </div>

      <Card className="border-border/40">
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Igrac</th>
                  <th className="text-center py-2 px-2">{tt("teams")}</th>
                  <th className="text-center py-2 px-2">{tt("attendance")}</th>
                  <th className="text-center py-2 px-2">{ts("goals")}</th>
                  <th className="text-center py-2 px-2">{ts("assists")}</th>
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
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant={row.training_team === "team_a" ? "default" : "ghost"}
                          className={`h-7 w-7 p-0 text-xs font-bold ${
                            row.training_team === "team_a"
                              ? "bg-white text-black hover:bg-white/90"
                              : "text-muted-foreground"
                          }`}
                          onClick={() =>
                            setTeam(idx, row.training_team === "team_a" ? null : "team_a")
                          }
                        >
                          A
                        </Button>
                        <Button
                          size="sm"
                          variant={row.training_team === "team_b" ? "default" : "ghost"}
                          className={`h-7 w-7 p-0 text-xs font-bold ${
                            row.training_team === "team_b"
                              ? "bg-gray-700 text-white hover:bg-gray-600"
                              : "text-muted-foreground"
                          }`}
                          onClick={() =>
                            setTeam(idx, row.training_team === "team_b" ? null : "team_b")
                          }
                        >
                          B
                        </Button>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleAttendance(idx)}
                        className={
                          row.attended
                            ? "text-green-400 hover:text-green-300"
                            : "text-red-400 hover:text-red-300"
                        }
                      >
                        {row.attended ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                      </Button>
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
                        disabled={!row.attended}
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
                        disabled={!row.attended}
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
    </div>
  );
}
