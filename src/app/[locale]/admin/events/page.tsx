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
import { Megaphone, Plus, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import type { TeamEvent, EventType, Tournament } from "@/types/database";
import {
  belgradeDateTimeLocalInputToUtcIso,
  formatInBelgrade,
} from "@/lib/utils/datetime";

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("name" in error && error.name === "AbortError") return true;
  if ("message" in error && typeof error.message === "string") {
    return error.message.toLowerCase().includes("abort");
  }
  return false;
}

export default function AdminEventsPage() {
  const t = useTranslations("admin");
  const tt = useTranslations("tournament");
  const tc = useTranslations("common");
  const te = useTranslations("events");

  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    title_ru: "",
    title_en: "",
    description: "",
    description_ru: "",
    description_en: "",
    event_type: "social" as EventType,
    event_date: "",
    location: "",
    tournament_id: "",
    is_published: true,
  });

  const supabase = useMemo(() => createClient(), []);

  async function loadData() {
    try {
      const [eventsRes, tournamentsRes] = await Promise.all([
        supabase.from("events").select("*").order("created_at", { ascending: false }),
        supabase.from("tournaments").select("*").order("start_date", { ascending: false }),
      ]);
      setEvents(eventsRes.data ?? []);
      setTournaments(tournamentsRes.data ?? []);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Failed to load admin events data", error);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const [eventsRes, tournamentsRes] = await Promise.all([
          supabase.from("events").select("*").order("created_at", { ascending: false }),
          supabase.from("tournaments").select("*").order("start_date", { ascending: false }),
        ]);
        if (!active) return;
        setEvents(eventsRes.data ?? []);
        setTournaments(tournamentsRes.data ?? []);
      } catch (error) {
        if (!isAbortError(error)) {
          console.error("Failed to load initial admin events data", error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSave() {
    setSaving(true);
    const { tournament_id, ...rest } = form;

    const eventDateUtc = form.event_date
      ? belgradeDateTimeLocalInputToUtcIso(form.event_date)
      : null;
    if (form.event_date && !eventDateUtc) {
      setSaving(false);
      return;
    }

    await supabase.from("events").insert({
      ...rest,
      event_date: eventDateUtc,
      location: form.location || null,
      tournament_id: tournament_id || null,
    });
    setDialogOpen(false);
    setSaving(false);
    setForm({
      title: "",
      title_ru: "",
      title_en: "",
      description: "",
      description_ru: "",
      description_en: "",
      event_type: "social",
      event_date: "",
      location: "",
      tournament_id: "",
      is_published: true,
    });
    loadData();
  }

  async function togglePublish(id: string, current: boolean) {
    await supabase
      .from("events")
      .update({ is_published: !current })
      .eq("id", id);
    loadData();
  }

  async function handleDeleteEvent(id: string) {
    if (!window.confirm(te("deleteConfirm"))) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      window.alert(te("deleteError", { message: error.message }));
      return;
    }
    loadData();
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
        <h1 className="text-2xl font-bold">{t("manageEvents")}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary">
              <Plus className="h-4 w-4 mr-2" />
              {tc("create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle>Novi dogadjaj</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Naslov (SR)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Naslov (RU)</Label>
                  <Input
                    value={form.title_ru}
                    onChange={(e) =>
                      setForm({ ...form, title_ru: e.target.value })
                    }
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Naslov (EN)</Label>
                  <Input
                    value={form.title_en}
                    onChange={(e) =>
                      setForm({ ...form, title_en: e.target.value })
                    }
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Opis (SR)</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tip</Label>
                  <Select
                    value={form.event_type}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        event_type: v as EventType,
                        tournament_id: v === "tournament" ? form.tournament_id : "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="game">Game</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="tournament">Tournament</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Datum</Label>
                  <Input
                    type="datetime-local"
                    value={form.event_date}
                    onChange={(e) =>
                      setForm({ ...form, event_date: e.target.value })
                    }
                    className="bg-background"
                  />
                </div>
              </div>
              {form.event_type === "tournament" && (
                <div className="space-y-2">
                  <Label>{tt("linkTournament")}</Label>
                  <Select
                    value={form.tournament_id || "__none__"}
                    onValueChange={(v) =>
                      setForm({ ...form, tournament_id: v === "__none__" ? "" : v })
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{tt("none")}</SelectItem>
                      {tournaments.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.start_date} — {t.end_date})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Lokacija</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || !form.title}
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
        {events.map((event) => (
          <Card key={event.id} className="border-border/40">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.event_type} |{" "}
                    {event.event_date
                      ? formatInBelgrade(event.event_date, "sr-Latn", { dateStyle: "short" })
                      : "Bez datuma"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    event.is_published
                      ? "bg-green-600/20 text-green-400"
                      : "bg-red-600/20 text-red-400"
                  }
                >
                  {event.is_published ? "Published" : "Draft"}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => togglePublish(event.id, event.is_published)}
                >
                  {event.is_published ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteEvent(event.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
