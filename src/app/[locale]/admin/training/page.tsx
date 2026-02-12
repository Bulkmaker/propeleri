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
import { CalendarDays, Plus, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import type { TrainingSession, Season, TrainingSessionStatus } from "@/types/database";
import {
  belgradeDateTimeLocalInputToUtcIso,
  belgradeMinuteKey,
  formatInBelgrade,
  utcToBelgradeDateTimeLocalInput,
} from "@/lib/utils/datetime";
import { LoadingErrorEmpty } from "@/components/shared/LoadingErrorEmpty";
import { SkeletonCardList } from "@/components/shared/skeletons";

const SESSION_STATUSES: TrainingSessionStatus[] = ["planned", "completed", "canceled"];
const WEEKDAY_OPTIONS = [
  { value: 1, key: "monday" },
  { value: 2, key: "tuesday" },
  { value: 3, key: "wednesday" },
  { value: 4, key: "thursday" },
  { value: 5, key: "friday" },
  { value: 6, key: "saturday" },
  { value: 0, key: "sunday" },
] as const;

function normalizeStatus(status: string | null | undefined): TrainingSessionStatus {
  if (status === "completed" || status === "canceled") return status;
  return "planned";
}

function statusBadgeClass(status: TrainingSessionStatus) {
  if (status === "completed") return "bg-green-500/10 text-green-500 border-green-500/20";
  if (status === "canceled") return "bg-red-500/10 text-red-500 border-red-500/20";
  return "bg-blue-500/10 text-blue-500 border-blue-500/20";
}

function dateMinuteKey(value: string) {
  return belgradeMinuteKey(value);
}

function formatDateISO(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminTrainingPage() {
  const t = useTranslations("admin");
  const tt = useTranslations("training");
  const tc = useTranslations("common");

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);

  const [form, setForm] = useState({
    season_id: "",
    title: "",
    session_date: "",
    location: "",
    status: "planned" as TrainingSessionStatus,
    notes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    season_id: "",
    title: "",
    location: "",
    status: "planned" as TrainingSessionStatus,
    start_date: "",
    end_date: "",
    time: "",
    weekdays: [1, 3, 5] as number[],
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleResult, setScheduleResult] = useState<{ created: number; skipped: number } | null>(
    null
  );

  const supabase = useMemo(() => createClient(), []);

  async function loadData() {
    const [sessionsRes, seasonsRes] = await Promise.all([
      supabase
        .from("training_sessions")
        .select("*")
        .order("session_date", { ascending: false }),
      supabase.from("seasons").select("*").order("start_date", { ascending: false }),
    ]);
    setSessions(sessionsRes.data ?? []);
    const loadedSeasons = seasonsRes.data ?? [];
    setSeasons(loadedSeasons);
    if (loadedSeasons[0]) {
      setForm((f) => ({ ...f, season_id: f.season_id || loadedSeasons[0].id }));
      setScheduleForm((f) => ({ ...f, season_id: f.season_id || loadedSeasons[0].id }));
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      const [sessionsRes, seasonsRes] = await Promise.all([
        supabase
          .from("training_sessions")
          .select("*")
          .order("session_date", { ascending: false }),
        supabase.from("seasons").select("*").order("start_date", { ascending: false }),
      ]);
      if (!active) return;

      setSessions(sessionsRes.data ?? []);
      const loadedSeasons = seasonsRes.data ?? [];
      setSeasons(loadedSeasons);
      if (loadedSeasons[0]) {
        setForm((f) => ({ ...f, season_id: f.season_id || loadedSeasons[0].id }));
        setScheduleForm((f) => ({ ...f, season_id: f.season_id || loadedSeasons[0].id }));
      }
      setLoading(false);
    }

    void loadInitialData();
    return () => {
      active = false;
    };
  }, [supabase]);

  function openCreate() {
    setEditingId(null);
    setError("");
    setForm({
      season_id: seasons[0]?.id ?? "",
      title: "",
      session_date: "",
      location: "",
      status: "planned",
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(session: TrainingSession) {
    setEditingId(session.id);
    setError("");
    setForm({
      season_id: session.season_id,
      title: session.title ?? "",
      session_date: utcToBelgradeDateTimeLocalInput(session.session_date),
      location: session.location ?? "",
      status: normalizeStatus(session.status),
      notes: session.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    const sessionDateUtc = belgradeDateTimeLocalInputToUtcIso(form.session_date);
    if (!sessionDateUtc) {
      setError(tt("invalidDate"));
      setSaving(false);
      return;
    }

    const data = {
      ...form,
      session_date: sessionDateUtc,
      title: form.title || null,
      location: form.location || null,
      notes: form.notes.trim() || null,
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
    void loadData();
  }

  function toggleWeekday(day: number) {
    setScheduleForm((prev) => {
      const hasDay = prev.weekdays.includes(day);
      const next = hasDay
        ? prev.weekdays.filter((item) => item !== day)
        : [...prev.weekdays, day].sort((a, b) => a - b);
      return { ...prev, weekdays: next };
    });
  }

  async function generateSchedule() {
    setScheduleError("");
    setScheduleResult(null);

    if (
      !scheduleForm.season_id ||
      !scheduleForm.start_date ||
      !scheduleForm.end_date ||
      !scheduleForm.time ||
      scheduleForm.weekdays.length === 0
    ) {
      setScheduleError(tt("validationRequired"));
      return;
    }

    const start = new Date(`${scheduleForm.start_date}T00:00`);
    const end = new Date(`${scheduleForm.end_date}T23:59:59`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setScheduleError(tt("validationRange"));
      return;
    }

    setScheduleSaving(true);

    const rangeStartUtc = belgradeDateTimeLocalInputToUtcIso(`${scheduleForm.start_date}T00:00`);
    const rangeEndUtc = belgradeDateTimeLocalInputToUtcIso(`${scheduleForm.end_date}T23:59`);
    if (!rangeStartUtc || !rangeEndUtc) {
      setScheduleError(tt("validationRange"));
      setScheduleSaving(false);
      return;
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("training_sessions")
      .select("session_date")
      .eq("season_id", scheduleForm.season_id)
      .gte("session_date", rangeStartUtc)
      .lte("session_date", rangeEndUtc);

    if (existingError) {
      setScheduleError(existingError.message);
      setScheduleSaving(false);
      return;
    }

    const existingKeys = new Set(
      (existingRows ?? []).map((row: Pick<TrainingSession, "session_date">) =>
        dateMinuteKey(row.session_date)
      )
    );

    const weekdays = new Set(scheduleForm.weekdays);
    const payload: {
      season_id: string;
      title: string | null;
      session_date: string;
      location: string | null;
      status: TrainingSessionStatus;
      notes: string | null;
    }[] = [];
    let skipped = 0;

    const cursor = new Date(start);
    while (cursor <= end) {
      if (weekdays.has(cursor.getDay())) {
        const localDate = formatDateISO(cursor);
        const sessionDate = `${localDate}T${scheduleForm.time}`;
        const sessionDateUtc = belgradeDateTimeLocalInputToUtcIso(sessionDate);
        if (!sessionDateUtc) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }
        const key = dateMinuteKey(sessionDateUtc);
        if (existingKeys.has(key)) {
          skipped += 1;
        } else {
          payload.push({
            season_id: scheduleForm.season_id,
            title: scheduleForm.title.trim() || null,
            session_date: sessionDateUtc,
            location: scheduleForm.location.trim() || null,
            status: scheduleForm.status,
            notes: null,
          });
          existingKeys.add(key);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (payload.length === 0) {
      setScheduleResult({ created: 0, skipped });
      setScheduleSaving(false);
      return;
    }

    const insertRes = await supabase.from("training_sessions").insert(payload);
    if (insertRes.error) {
      setScheduleError(insertRes.error.message);
      setScheduleSaving(false);
      return;
    }

    setScheduleResult({ created: payload.length, skipped });
    setScheduleSaving(false);
    void loadData();
  }

  async function handleDeleteSession(sessionId: string) {
    if (!window.confirm(tt("deleteConfirm"))) return;

    setDeletingId(sessionId);
    setError("");

    const statsDeleteRes = await supabase
      .from("training_stats")
      .delete()
      .eq("session_id", sessionId);

    if (statsDeleteRes.error) {
      setError(statsDeleteRes.error.message);
      setDeletingId(null);
      return;
    }

    const sessionDeleteRes = await supabase
      .from("training_sessions")
      .delete()
      .eq("id", sessionId);

    if (sessionDeleteRes.error) {
      setError(sessionDeleteRes.error.message);
      setDeletingId(null);
      return;
    }

    if (editingId === sessionId) {
      setDialogOpen(false);
    }

    await loadData();
    setDeletingId(null);
  }

  return (
    <LoadingErrorEmpty loading={loading} isEmpty={sessions.length === 0} onRetry={loadData} skeleton={<SkeletonCardList count={8} />}>
      <div>
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-bold truncate">{t("manageTraining")}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowGenerator(!showGenerator)}
              className={showGenerator ? "bg-accent" : ""}
              size="sm"
            >
              <Sparkles className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{tt("scheduleGenerator")}</span>
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate} className="bg-primary" size="sm">
                  <Plus className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">{tc("create")}</span>
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
                    <Label>{t("season")}</Label>
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
                    <Label>{t("titleOptional")}</Label>
                    <Input
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      placeholder={tt("titlePlaceholder")}
                      className="bg-background"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("dateAndTime")}</Label>
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
                      <Label>{t("location")}</Label>
                      <Input
                        value={form.location}
                        onChange={(e) =>
                          setForm({ ...form, location: e.target.value })
                        }
                        className="bg-background"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("sessionStatus")}</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) =>
                        setForm({ ...form, status: normalizeStatus(v) })
                      }
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SESSION_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {tt(`status.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("report")}</Label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder={tt("reportPlaceholder")}
                      className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
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
        </div>

        <div className="p-6 space-y-6">

          {showGenerator && (
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="font-medium">{tt("scheduleGenerator")}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("season")}</Label>
                    <Select
                      value={scheduleForm.season_id}
                      onValueChange={(v) => setScheduleForm({ ...scheduleForm, season_id: v })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {seasons.map((season) => (
                          <SelectItem key={season.id} value={season.id}>
                            {season.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("sessionStatus")}</Label>
                    <Select
                      value={scheduleForm.status}
                      onValueChange={(v) =>
                        setScheduleForm({ ...scheduleForm, status: normalizeStatus(v) })
                      }
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SESSION_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {tt(`status.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{tt("startDate")}</Label>
                    <Input
                      type="date"
                      value={scheduleForm.start_date}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, start_date: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("endDate")}</Label>
                    <Input
                      type="date"
                      value={scheduleForm.end_date}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, end_date: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tt("time")}</Label>
                    <Input
                      type="time"
                      value={scheduleForm.time}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("titleOptional")}</Label>
                    <Input
                      value={scheduleForm.title}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("locationOptional")}</Label>
                    <Input
                      value={scheduleForm.location}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{tt("weekdays")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const active = scheduleForm.weekdays.includes(day.value);
                      return (
                        <Button
                          key={day.value}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() => toggleWeekday(day.value)}
                        >
                          {tt(day.key)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                {scheduleError && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {scheduleError}
                  </p>
                )}
                {scheduleResult && (
                  <div className="rounded-md border border-border/50 px-3 py-2 text-sm space-y-1">
                    {scheduleResult.created > 0 ? (
                      <p>{tt("createdCount", { count: scheduleResult.created })}</p>
                    ) : (
                      <p>{tt("noGeneratedSessions")}</p>
                    )}
                    {scheduleResult.skipped > 0 && (
                      <p className="text-muted-foreground">
                        {tt("skippedDuplicates", { count: scheduleResult.skipped })}
                      </p>
                    )}
                  </div>
                )}
                <Button onClick={generateSchedule} disabled={scheduleSaving} className="w-full md:w-auto">
                  {scheduleSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {tt("generateSchedule")}
                </Button>
              </CardContent>
            </Card>
          )}

          {sessions.map((session) => (
            <Card key={session.id} className="border-border/40">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CalendarDays className="h-5 w-5 text-blue-400 mt-0.5 md:mt-0" />
                  <div>
                    <div className="font-medium text-sm flex flex-wrap items-center gap-2">
                      <span>{session.title || tt("session")}</span>
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(normalizeStatus(session.status))}
                      >
                        {tt(`status.${normalizeStatus(session.status)}`)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatInBelgrade(session.session_date, "sr-Latn", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {session.location && ` — ${session.location}`}
                    </p>
                    {session.notes && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-xl truncate">
                        {session.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(session)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Link href={`/admin/training/${session.id}`}>
                    <Button size="sm" variant="outline" className="text-xs">
                      {t("stats")}
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSession(session.id)}
                    disabled={deletingId === session.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {deletingId === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
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
