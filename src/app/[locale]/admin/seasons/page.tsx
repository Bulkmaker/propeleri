"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
import { Trophy, Plus, Loader2 } from "lucide-react";
import type { Season } from "@/types/database";

export default function AdminSeasonsPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_current: false,
  });

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await supabase
      .from("seasons")
      .select("*")
      .order("start_date", { ascending: false });
    setSeasons(data ?? []);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);

    if (form.is_current) {
      // Unset other current seasons
      await supabase
        .from("seasons")
        .update({ is_current: false })
        .eq("is_current", true);
    }

    await supabase.from("seasons").insert(form);

    setDialogOpen(false);
    setSaving(false);
    setForm({ name: "", start_date: "", end_date: "", is_current: false });
    loadData();
  }

  async function setCurrent(id: string) {
    await supabase
      .from("seasons")
      .update({ is_current: false })
      .eq("is_current", true);
    await supabase.from("seasons").update({ is_current: true }).eq("id", id);
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
        <h1 className="text-2xl font-bold">{t("manageSeasons")}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary">
              <Plus className="h-4 w-4 mr-2" />
              {tc("create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Nova sezona</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Naziv</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="2025/2026"
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pocetak</Label>
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
                  <Label>Kraj</Label>
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_current}
                  onChange={(e) =>
                    setForm({ ...form, is_current: e.target.checked })
                  }
                />
                Trenutna sezona
              </label>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name || !form.start_date || !form.end_date}
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
                    Trenutna
                  </Badge>
                )}
              </div>
              {!season.is_current && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrent(season.id)}
                >
                  Postavi kao trenutnu
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
