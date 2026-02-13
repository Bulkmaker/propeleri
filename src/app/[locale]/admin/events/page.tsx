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
import { Megaphone, Plus, Eye, EyeOff, Trash2 } from "lucide-react";
import type { TeamEvent, EventType, Tournament } from "@/types/database";
import {
  belgradeDateTimeLocalInputToUtcIso,
  formatInBelgrade,
} from "@/lib/utils/datetime";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { LoadingErrorEmpty } from "@/components/shared/LoadingErrorEmpty";
import { SkeletonCardList } from "@/components/shared/skeletons";
import { useAdminData } from "@/hooks/use-admin-data";
import { SelectWithNone } from "@/components/ui/SelectWithNone";

export default function AdminEventsPage() {
  const t = useTranslations("admin");
  const tt = useTranslations("tournament");
  const tc = useTranslations("common");
  const te = useTranslations("events");

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
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

  const queryFn = useCallback(
    (sb: Parameters<Parameters<typeof useAdminData>[0]>[0]) =>
      sb.from("events").select("*").order("created_at", { ascending: false }),
    []
  );

  const { data: events, loading, error, reload, supabase } = useAdminData<TeamEvent>(queryFn);

  // Load tournaments separately (needed for form dropdown)
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("*")
        .order("start_date", { ascending: false });
      setTournaments(data ?? []);
    }, 0);
    return () => window.clearTimeout(timer);
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
    await reload();
  }

  async function togglePublish(id: string, current: boolean) {
    await supabase
      .from("events")
      .update({ is_published: !current })
      .eq("id", id);
    await reload();
  }

  async function handleDeleteEvent(id: string) {
    if (!window.confirm(te("deleteConfirm"))) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      window.alert(te("deleteError", { message: error.message }));
      return;
    }
    await reload();
  }

  return (
    <LoadingErrorEmpty loading={loading} error={error} isEmpty={events.length === 0} onRetry={reload} skeleton={<SkeletonCardList count={6} />}>
      <div>
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/40 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("manageEvents")}</h1>
          <AdminDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title={t("newEvent")}
            saving={saving}
            disabled={!form.title}
            onSave={handleSave}
            className="max-w-lg"
            trigger={
              <Button onClick={() => setDialogOpen(true)} className="bg-primary">
                <Plus className="h-4 w-4 mr-2" />
                {tc("create")}
              </Button>
            }
          >
            <div className="max-h-[70vh] overflow-y-auto space-y-4">
              <div className="space-y-2">
                <Label>{t("titleSr")}</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("titleRu")}</Label>
                  <Input
                    value={form.title_ru}
                    onChange={(e) => setForm({ ...form, title_ru: e.target.value })}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("titleEn")}</Label>
                  <Input
                    value={form.title_en}
                    onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("descriptionSr")}</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("eventType")}</Label>
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
                      <SelectItem value="game">{te("game")}</SelectItem>
                      <SelectItem value="training">{te("training")}</SelectItem>
                      <SelectItem value="tournament">{te("tournament")}</SelectItem>
                      <SelectItem value="social">{te("social")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("date")}</Label>
                  <Input
                    type="datetime-local"
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    className="bg-background"
                  />
                </div>
              </div>
              {form.event_type === "tournament" && (
                <div className="space-y-2">
                  <Label>{tt("linkTournament")}</Label>
                  <SelectWithNone
                    value={form.tournament_id}
                    onValueChange={(v) => setForm({ ...form, tournament_id: v })}
                    options={tournaments.map((t) => ({
                      value: t.id,
                      label: `${t.name} (${t.start_date} — ${t.end_date})`,
                    }))}
                    noneLabel={tt("none")}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("location")}</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>
          </AdminDialog>
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
                        ? formatInBelgrade(event.event_date, "sr-Latn", {
                            dateStyle: "short",
                          })
                        : t("noDate")}
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
                    {event.is_published ? t("published") : t("draft")}
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
    </LoadingErrorEmpty>
  );
}
