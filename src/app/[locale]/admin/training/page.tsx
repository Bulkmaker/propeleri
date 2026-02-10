"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { CalendarDays, Plus, Loader2, Pencil } from "lucide-react";
import type { TrainingSession, Season } from "@/types/database";

export default function AdminTrainingPage() {
  const t = useTranslations("admin");
  const tt = useTranslations("training");
  const tc = useTranslations("common");

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    season_id: "",
    title: "",
    session_date: "",
    location: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [sessionsRes, seasonsRes] = await Promise.all([
      supabase
        .from("training_sessions")
        .select("*")
        .order("session_date", { ascending: false }),
      supabase.from("seasons").select("*").order("start_date", { ascending: false }),
    ]);
    setSessions(sessionsRes.data ?? []);
    setSeasons(seasonsRes.data ?? []);
    if (seasonsRes.data?.[0]) {
      setForm((f) => ({ ...f, season_id: seasonsRes.data![0].id }));
    }
    setLoading(false);
  }

  function openCreate() {
    setEditingId(null);
    setError("");
    setForm({
      season_id: seasons[0]?.id ?? "",
      title: "",
      session_date: "",
      location: "",
    });
    setDialogOpen(true);
  }

  function openEdit(session: TrainingSession) {
    setEditingId(session.id);
    setError("");
    setForm({
      season_id: session.season_id,
      title: session.title ?? "",
      session_date: session.session_date.slice(0, 16),
      location: session.location ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const data = {
      ...form,
      title: form.title || null,
      location: form.location || null,
    };

    const res = editingId
      ? await supabase.from("training_sessions").update(data).eq("id", editingId)
      : await supabase.from("training_sessions").insert(data);

    if (res.error) {
      setError(res.error.message);
      setSaving(false);
      return;
    }

    setDialogOpen(false);
    setSaving(false);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("manageTraining")}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="bg-primary">
              <Plus className="h-4 w-4 mr-2" />
              {tc("create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>
                {editingId ? tc("edit") : tc("create")} - {tt("session")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Sezona</Label>
                <Select
                  value={form.season_id}
                  onValueChange={(v) => setForm({ ...form, season_id: v })}
                >
                  <SelectTrigger>
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
                <Label>Naziv (opciono)</Label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                  placeholder="npr. Utorkom trening"
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Datum i vreme</Label>
                  <Input
                    type="datetime-local"
                    value={form.session_date}
                    onChange={(e) =>
                      setForm({ ...form, session_date: e.target.value })
                    }
                    className="bg-background"
                  />
                </div>
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
              </div>
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || !form.session_date}
                className="w-full bg-primary"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tc("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {sessions.map((session) => (
          <Card key={session.id} className="border-border/40">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="font-medium text-sm">
                    {session.title || tt("session")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.session_date).toLocaleDateString("sr-Latn", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {session.location && ` — ${session.location}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(session)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Link href={`/admin/training/${session.id}`}>
                  <Button size="sm" variant="outline" className="text-xs">
                    Stats
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
