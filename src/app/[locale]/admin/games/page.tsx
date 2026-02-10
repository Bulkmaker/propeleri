"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Swords, Plus, Loader2, Pencil } from "lucide-react";
import type { Game, Season, GameResult } from "@/types/database";
import { RESULT_COLORS } from "@/lib/utils/constants";

export default function AdminGamesPage() {
  const t = useTranslations("admin");
  const tg = useTranslations("game");
  const tc = useTranslations("common");

  const [games, setGames] = useState<Game[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    season_id: "",
    opponent: "",
    location: "",
    game_date: "",
    is_home: true,
    home_score: 0,
    away_score: 0,
    result: "pending" as GameResult,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [gamesRes, seasonsRes] = await Promise.all([
      supabase.from("games").select("*").order("game_date", { ascending: false }),
      supabase.from("seasons").select("*").order("start_date", { ascending: false }),
    ]);
    setGames(gamesRes.data ?? []);
    setSeasons(seasonsRes.data ?? []);
    if (seasonsRes.data?.[0]) {
      setForm((f) => ({ ...f, season_id: seasonsRes.data![0].id }));
    }
    setLoading(false);
  }

  function openCreateDialog() {
    setEditingId(null);
    setForm({
      season_id: seasons[0]?.id ?? "",
      opponent: "",
      location: "",
      game_date: "",
      is_home: true,
      home_score: 0,
      away_score: 0,
      result: "pending",
    });
    setDialogOpen(true);
  }

  function openEditDialog(game: Game) {
    setEditingId(game.id);
    setForm({
      season_id: game.season_id,
      opponent: game.opponent,
      location: game.location ?? "",
      game_date: game.game_date.slice(0, 16),
      is_home: game.is_home,
      home_score: game.home_score,
      away_score: game.away_score,
      result: game.result,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const data = {
      ...form,
      location: form.location || null,
    };

    if (editingId) {
      await supabase.from("games").update(data).eq("id", editingId);
    } else {
      await supabase.from("games").insert(data);
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
        <h1 className="text-2xl font-bold">{t("manageGames")}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-primary">
              <Plus className="h-4 w-4 mr-2" />
              {tc("create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>
                {editingId ? tc("edit") : tc("create")} - {tc("games")}
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
                <Label>Protivnik</Label>
                <Input
                  value={form.opponent}
                  onChange={(e) =>
                    setForm({ ...form, opponent: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Datum i vreme</Label>
                  <Input
                    type="datetime-local"
                    value={form.game_date}
                    onChange={(e) =>
                      setForm({ ...form, game_date: e.target.value })
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
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Domaci gol</Label>
                  <Input
                    type="number"
                    value={form.home_score}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        home_score: parseInt(e.target.value) || 0,
                      })
                    }
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gosti gol</Label>
                  <Input
                    type="number"
                    value={form.away_score}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        away_score: parseInt(e.target.value) || 0,
                      })
                    }
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rezultat</Label>
                  <Select
                    value={form.result}
                    onValueChange={(v) =>
                      setForm({ ...form, result: v as GameResult })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{tg("result.pending")}</SelectItem>
                      <SelectItem value="win">{tg("result.win")}</SelectItem>
                      <SelectItem value="loss">{tg("result.loss")}</SelectItem>
                      <SelectItem value="draw">{tg("result.draw")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || !form.opponent || !form.game_date}
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
        {games.map((game) => (
          <Card key={game.id} className="border-border/40">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-bold">Propeleri</span>
                  <span className="mx-2 text-muted-foreground">
                    {game.home_score} : {game.away_score}
                  </span>
                  <span className="font-bold">{game.opponent}</span>
                </div>
                <Badge className={`text-xs ${RESULT_COLORS[game.result as GameResult]}`}>
                  {tg(`result.${game.result}`)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(game.game_date).toLocaleDateString("sr-Latn")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditDialog(game)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Link href={`/admin/games/${game.id}/stats`}>
                  <Button size="sm" variant="outline" className="text-xs">
                    Stats
                  </Button>
                </Link>
                <Link href={`/games/${game.id}/lineup`}>
                  <Button size="sm" variant="outline" className="text-xs border-primary/30 text-primary">
                    Lineup
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
