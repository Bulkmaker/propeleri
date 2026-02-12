"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Plus, Upload } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TeamAvatar } from "@/components/matches/TeamAvatar";
import imageCompression from "browser-image-compression";
import type { Game, GameResult, Team } from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";
import { formatInBelgrade } from "@/lib/utils/datetime";
import { COUNTRY_OPTIONS, countryFlagEmoji, countryDisplayName } from "@/lib/utils/country";

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
    const [teamsRes, gamesRes] = await Promise.all([
      supabase.from("teams").select("*").order("name", { ascending: true }),
      supabase.from("games").select("*").order("game_date", { ascending: false }),
    ]);

    setTeams((teamsRes.data ?? []) as Team[]);
    setGames((gamesRes.data ?? []) as Game[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);


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

    const payload = {
      name: form.name.trim(),
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      logo_url: form.logo_url.trim() || null,
      is_propeleri: form.is_propeleri,
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
    const map = new Map<string, Game[]>();
    for (const team of teams) {
      if (team.is_propeleri) continue;

      const teamName = normalizeName(team.name);
      const gamesForTeam = games.filter((game) => {
        // Match by opponent_team_id if available
        if (game.opponent_team_id) {
          return game.opponent_team_id === team.id;
        }

        // Fallback to name matching for old games
        if (game.opponent) {
          return normalizeName(game.opponent) === teamName;
        }

        return false;
      });

      map.set(
        team.id,
        [...gamesForTeam].sort(
          (a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
        )
      );
    }

    return map;
  }, [games, teams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader title={t("manageTeams")}>
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
                  <Select
                    value={form.country || "__none__"}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        country: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={tt("country")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {COUNTRY_OPTIONS.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {countryFlagEmoji(option.code)} {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
      </AdminPageHeader>

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
                    <TeamAvatar
                      name={team.name}
                      logoUrl={team.logo_url}
                      country={team.country}
                      size="md"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{team.name}</p>
                        {team.is_propeleri && (
                          <Badge className="bg-primary/20 text-primary">{tt("propeleri")}</Badge>
                        )}
                      </div>
                      {(team.city || team.country) && (
                        <p className="text-xs text-muted-foreground">
                          {[team.city, team.country ? countryDisplayName(team.country) : null].filter(Boolean).join(", ")}
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
