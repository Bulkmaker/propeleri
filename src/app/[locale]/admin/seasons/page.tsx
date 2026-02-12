"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { LoadingErrorEmpty } from "@/components/shared/LoadingErrorEmpty";
import { useAdminData } from "@/hooks/use-admin-data";
import type { Season } from "@/types/database";

export default function AdminSeasonsPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_current: false,
  });

  const queryFn = useCallback(
    (sb: Parameters<Parameters<typeof useAdminData>[0]>[0]) =>
      sb.from("seasons").select("*").order("start_date", { ascending: false }),
    []
  );

  const { data: seasons, loading, error, reload, supabase } = useAdminData<Season>(queryFn);

  async function handleSave() {
    setSaving(true);

    if (form.is_current) {
      await supabase
        .from("seasons")
        .update({ is_current: false })
        .eq("is_current", true);
    }

    await supabase.from("seasons").insert(form);

    setDialogOpen(false);
    setSaving(false);
    setForm({ name: "", start_date: "", end_date: "", is_current: false });
    await reload();
  }

  async function setCurrent(id: string) {
    await supabase
      .from("seasons")
      .update({ is_current: false })
      .eq("is_current", true);
    await supabase.from("seasons").update({ is_current: true }).eq("id", id);
    await reload();
  }

  return (
    <LoadingErrorEmpty loading={loading} error={error} isEmpty={seasons.length === 0} onRetry={reload}>
      <div>
        <AdminPageHeader title={t("manageSeasons")}>
          <AdminDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title={t("newSeason")}
            saving={saving}
            disabled={!form.name || !form.start_date || !form.end_date}
            onSave={handleSave}
            trigger={
              <Button onClick={() => setDialogOpen(true)} className="bg-primary">
                <Plus className="h-4 w-4 mr-2" />
                {tc("create")}
              </Button>
            }
          >
            <div className="space-y-2">
              <Label>{t("seasonName")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="2025/2026"
                className="bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("seasonStart")}</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("seasonEnd")}</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_current}
                onChange={(e) => setForm({ ...form, is_current: e.target.checked })}
              />
              {t("currentSeason")}
            </label>
          </AdminDialog>
        </AdminPageHeader>

        <div className="p-6 space-y-2">
          {seasons.map((season) => (
            <Card key={season.id} className="border-border/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">{season.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {season.start_date} — {season.end_date}
                    </p>
                  </div>
                  {season.is_current && (
                    <Badge className="bg-green-600/20 text-green-400">
                      {t("current")}
                    </Badge>
                  )}
                </div>
                {!season.is_current && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrent(season.id)}
                  >
                    {t("setAsCurrent")}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </LoadingErrorEmpty>
  );
}
