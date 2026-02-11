"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Link } from "@/i18n/navigation";
import { Award, Plus, Loader2, Pencil, Trash2, Settings } from "lucide-react";
import type { Tournament, Season, TournamentFormat } from "@/types/database";

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  cup: "formatCup",
  placement: "formatPlacement",
  round_robin: "formatRoundRobin",
  custom: "formatCustom",
};

export default function AdminTournamentsPage() {
  const t = useTranslations("admin");
  const tt = useTranslations("tournament");
  const tc = useTranslations("common");

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    season_id: "",
    name: "",
    format: "custom" as TournamentFormat,
    location: "",
    start_date: "",
    end_date: "",
    description: "",
  });

  const supabase = useMemo(() => createClient(), []);

  async function loadData() {
    const [tournamentsRes, seasonsRes] = await Promise.all([
      supabase
        .from("tournaments")
        .select("*")
        .order("start_date", { ascending: false }),
      supabase
        .from("seasons")
        .select("*")
        .order("start_date", { ascending: false }),
    ]);
    setTournaments(tournamentsRes.data ?? []);
    const allSeasons = seasonsRes.data ?? [];
    setSeasons(allSeasons);
    if (allSeasons[0] && !form.season_id) {
      setForm((f) => ({ ...f, season_id: allSeasons[0].id }));
    }
    setLoading(false);
  }

  useEffect(() => {
    async function loadInitialData() {
      const [tournamentsRes, seasonsRes] = await Promise.all([
        supabase
          .from("tournaments")
          .select("*")
          .order("start_date", { ascending: false }),
        supabase
          .from("seasons")
          .select("*")
          .order("start_date", { ascending: false }),
      ]);
      setTournaments(tournamentsRes.data ?? []);
      const allSeasons = seasonsRes.data ?? [];
      setSeasons(allSeasons);
      if (allSeasons[0]) {
        setForm((f) => (f.season_id ? f : { ...f, season_id: allSeasons[0].id }));
      }
      setLoading(false);
    }

    void loadInitialData();
  }, [supabase]);

  function openCreateDialog() {
    setEditingId(null);
    setForm({
      season_id: seasons[0]?.id ?? "",
      name: "",
      format: "custom",
      location: "",
      start_date: "",
      end_date: "",
      description: "",
    });
    setDialogOpen(true);
  }

  function openEditDialog(tournament: Tournament) {
    setEditingId(tournament.id);
    setForm({
      season_id: tournament.season_id,
      name: tournament.name,
      format: tournament.format,
      location: tournament.location ?? "",
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      description: tournament.description ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      season_id: form.season_id,
      name: form.name,
      format: form.format,
      location: form.location || null,
      start_date: form.start_date,
      end_date: form.end_date,
      description: form.description || null,
    };
    const eventPayload = {
      title: form.name,
      title_ru: null,
      title_en: null,
      description: form.description || null,
      description_ru: null,
      description_en: null,
      event_type: "tournament" as const,
      event_date: form.start_date || null,
      location: form.location || null,
    };

    if (editingId) {
      await supabase.from("tournaments").update(payload).eq("id", editingId);

      const { data: linkedEvent } = await supabase
        .from("events")
        .select("id")
        .eq("tournament_id", editingId)
        .eq("event_type", "tournament")
        .limit(1)
        .maybeSingle();

      if (linkedEvent?.id) {
        await supabase.from("events").update(eventPayload).eq("id", linkedEvent.id);
      } else {
        await supabase.from("events").insert({
          ...eventPayload,
          tournament_id: editingId,
          is_published: true,
        });
      }
    } else {
      const { data: createdTournament } = await supabase
        .from("tournaments")
        .insert(payload)
        .select("id")
        .single();

      if (createdTournament?.id) {
        await supabase.from("events").insert({
          ...eventPayload,
          tournament_id: createdTournament.id,
          is_published: true,
        });
      }
    }

    setDialogOpen(false);
    setSaving(false);
    setEditingId(null);
    loadData();
  }

  async function handleDelete(id: string) {
    await supabase.from("tournaments").delete().eq("id", id);
    loadData();
  }

  function getSeasonName(seasonId: string) {
    return seasons.find((s) => s.id === seasonId)?.name ?? "";
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
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("manageTournaments")}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {tc("create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>
                {editingId ? tc("edit") : tt("newTournament")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tt("season")}</Label>
                  <Select
                    value={form.season_id}
                    onValueChange={(v) => setForm({ ...form, season_id: v })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {seasons.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{tt("format")}</Label>
                  <Select
                    value={form.format}
                    onValueChange={(v) =>
                      setForm({ ...form, format: v as TournamentFormat })
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cup">{tt("formatCup")}</SelectItem>
                      <SelectItem value="placement">{tt("formatPlacement")}</SelectItem>
                      <SelectItem value="round_robin">{tt("formatRoundRobin")}</SelectItem>
                      <SelectItem value="custom">{tt("formatCustom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tt("name")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{tt("location")}</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tt("startDate")}</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tt("endDate")}</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tt("description")}</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.name ||
                  !form.start_date ||
                  !form.end_date ||
                  !form.season_id
                }
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
        {tournaments.length === 0 ? (
          <p className="text-muted-foreground text-center py-10">
            {tt("noTournaments")}
          </p>
        ) : (
          tournaments.map((tournament) => (
            <Card key={tournament.id} className="border-border/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">{tournament.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tournament.start_date} — {tournament.end_date}
                      {tournament.location && ` | ${tournament.location}`}
                    </p>
                  </div>
                  <Badge className="bg-primary/20 text-primary text-xs">
                    {getSeasonName(tournament.season_id)}
                  </Badge>
                  <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                    {tt(FORMAT_LABELS[tournament.format as TournamentFormat] ?? "formatCustom")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/tournaments/${tournament.id}`}>
                    <Button size="sm" variant="outline" className="text-xs">
                      <Settings className="h-3 w-3 mr-1" />
                      {tt("manageTournament")}
                    </Button>
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditDialog(tournament)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(tournament.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
