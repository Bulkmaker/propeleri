"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Plus, Upload } from "lucide-react";
import imageCompression from "browser-image-compression";
import type { Game, GameResult, Opponent, Team } from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";
import { formatInBelgrade } from "@/lib/utils/datetime";

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

type TeamForm = {
  name: string;
  city: string;
  country: string;
  logo_url: string;
  is_propeleri: boolean;
};

export default function AdminTeamsPage() {
  const t = useTranslations("admin");
  const tg = useTranslations("game");
  const tt = useTranslations("tournament");
  const tc = useTranslations("common");

  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [form, setForm] = useState<TeamForm>({
    name: "",
    city: "",
    country: "",
    logo_url: "",
    is_propeleri: false,
  });

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    const [teamsRes, gamesRes, opponentsRes] = await Promise.all([
      supabase.from("teams").select("*").order("name", { ascending: true }),
      supabase.from("games").select("*").order("game_date", { ascending: false }),
      supabase
        .from("opponents")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    setTeams((teamsRes.data ?? []) as Team[]);
    setGames((gamesRes.data ?? []) as Game[]);
    setOpponents((opponentsRes.data ?? []) as Opponent[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  function findOpponentByName(value: string) {
    const normalized = normalizeName(value);
    return opponents.find((opponent) => normalizeName(opponent.name) === normalized) ?? null;
  }

  async function ensureOpponent(name: string): Promise<Opponent | null> {
    const cleaned = name.trim();
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
      setError(insertError.message);
      return null;
    }

    return inserted as Opponent;
  }

  async function uploadTeamLogo(file: File) {
    setUploadingLogo(true);
    setError("");

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.25,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });

      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ownerId = user?.id ?? "admin";
      const filePath = `${ownerId}/teams/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressed, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setForm((prev) => ({ ...prev, logo_url: publicUrl }));
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload team logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  function openCreateDialog() {
    setEditingTeam(null);
    setError("");
    setForm({
      name: "",
      city: "",
      country: "",
      logo_url: "",
      is_propeleri: false,
    });
    setDialogOpen(true);
  }

  function openEditDialog(team: Team) {
    setEditingTeam(team);
    setError("");
    setForm({
      name: team.name,
      city: team.city ?? "",
      country: team.country ?? "",
      logo_url: team.logo_url ?? "",
      is_propeleri: team.is_propeleri,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;

    setSaving(true);
    setError("");

    let opponentId: string | null = null;
    if (!form.is_propeleri) {
      const opponent = await ensureOpponent(form.name);
      if (!opponent) {
        setSaving(false);
        return;
      }
      opponentId = opponent.id;
    }

    const payload = {
      name: form.name.trim(),
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      logo_url: form.logo_url.trim() || null,
      is_propeleri: form.is_propeleri,
      opponent_id: form.is_propeleri ? null : opponentId,
    };

    const result = editingTeam
      ? await supabase.from("teams").update(payload).eq("id", editingTeam.id)
      : await supabase.from("teams").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setDialogOpen(false);
    setSaving(false);
    await loadData();
  }

  const historyByTeam = useMemo(() => {
    const normalizedOpponentById = new Map<string, string>();
    for (const opponent of opponents) {
      normalizedOpponentById.set(opponent.id, normalizeName(opponent.name));
    }

    const map = new Map<string, Game[]>();
    for (const team of teams) {
      if (team.is_propeleri) continue;

      const teamName = normalizeName(team.name);
      const gamesForTeam = games.filter((game) => {
        if (team.opponent_id && game.opponent_id) {
          return game.opponent_id === team.opponent_id;
        }

        if (team.opponent_id && !game.opponent_id) {
          return teamName === normalizeName(game.opponent);
        }

        if (!team.opponent_id && game.opponent_id) {
          const opponentName = normalizedOpponentById.get(game.opponent_id);
          return opponentName === teamName;
        }

        return normalizeName(game.opponent) === teamName;
      });

      map.set(
        team.id,
        [...gamesForTeam].sort(
          (a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
        )
      );
    }

    return map;
  }, [games, opponents, teams]);

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
        <h1 className="text-2xl font-bold">{t("manageTeams")}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-primary">
              <Plus className="h-4 w-4 mr-2" />
              {tc("create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingTeam ? tc("edit") : tc("create")} - {tt("teams")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{tt("teamName")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tt("city")}</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tt("country")}</Label>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{tt("teamLogo")}</Label>
                <Input
                  value={form.logo_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
                  className="bg-background"
                  placeholder="https://..."
                />
                <label className="cursor-pointer inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingLogo || saving}
                    onChange={async (e) => {
                      const input = e.currentTarget;
                      const file = input.files?.[0];
                      if (file) {
                        await uploadTeamLogo(file);
                      }
                      input.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={uploadingLogo || saving}
                  >
                    <span>
                      {uploadingLogo ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {tt("uploadLogo")}
                    </span>
                  </Button>
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_propeleri}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, is_propeleri: e.target.checked }))
                  }
                />
                {tt("propeleri")}
              </label>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                onClick={handleSave}
                disabled={saving || uploadingLogo || !form.name.trim()}
                className="w-full bg-primary"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tc("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-6 space-y-2">
        {teams.map((team) => {
          const history = historyByTeam.get(team.id) ?? [];
          const recentHistory = history.slice(0, 5);
          const wins = history.filter((game) => game.result === "win").length;
          const losses = history.filter((game) => game.result === "loss").length;
          const draws = history.filter((game) => game.result === "draw").length;

          return (
            <Card key={team.id} className="border-border/40">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {team.logo_url ? (
                      <Image
                        src={team.logo_url}
                        alt={team.name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover border border-border/40"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full border border-border/40 flex items-center justify-center bg-muted text-sm font-medium">
                        {team.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{team.name}</p>
                        {team.is_propeleri && (
                          <Badge className="bg-primary/20 text-primary">{tt("propeleri")}</Badge>
                        )}
                      </div>
                      {(team.city || team.country) && (
                        <p className="text-xs text-muted-foreground">
                          {[team.city, team.country].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEditDialog(team)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>

                {!team.is_propeleri && (
                  <div className="space-y-2 rounded-md border border-border/40 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">{tt("opponentHistory")}</p>
                      <div className="flex items-center gap-1 text-xs">
                        <Badge className={`${RESULT_COLORS.win}`}>{tg("result.win")}: {wins}</Badge>
                        <Badge className={`${RESULT_COLORS.loss}`}>{tg("result.loss")}: {losses}</Badge>
                        <Badge className={`${RESULT_COLORS.draw}`}>{tg("result.draw")}: {draws}</Badge>
                      </div>
                    </div>

                    {recentHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{tt("noMatches")}</p>
                    ) : (
                      <div className="space-y-1">
                        {recentHistory.map((game) => (
                          <div
                            key={game.id}
                            className="text-xs text-muted-foreground flex items-center justify-between"
                          >
                            <span>{formatInBelgrade(game.game_date, "sr-Latn", { dateStyle: "short" })}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {game.is_home ? game.home_score : game.away_score} : {game.is_home ? game.away_score : game.home_score}
                              </span>
                              <Badge className={`text-[10px] ${RESULT_COLORS[game.result as GameResult]}`}>
                                {tg(`result.${game.result}`)}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
