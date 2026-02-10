"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, XCircle, Users, Loader2, Pencil } from "lucide-react";
import type { Profile, PlayerRole, AppRole, PlayerPosition, TrainingTeam } from "@/types/database";
import { POSITION_COLORS, POSITIONS } from "@/lib/utils/constants";

interface PlayerForm {
  first_name: string;
  last_name: string;
  jersey_number: string;
  position: PlayerPosition;
  team_role: PlayerRole;
  app_role: AppRole;
  height: string;
  weight: string;
  date_of_birth: string;
  phone: string;
  bio: string;
  default_training_team: string;
  is_active: boolean;
  is_approved: boolean;
}

export default function AdminPlayersPage() {
  const t = useTranslations("admin");
  const tp = useTranslations("positions");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const tt = useTranslations("training");

  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null);
  const [form, setForm] = useState<PlayerForm>({
    first_name: "",
    last_name: "",
    jersey_number: "",
    position: "forward",
    team_role: "player",
    app_role: "player",
    height: "",
    weight: "",
    date_of_birth: "",
    phone: "",
    bio: "",
    default_training_team: "none",
    is_active: true,
    is_approved: true,
  });

  const supabase = createClient();

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("is_approved", { ascending: true })
      .order("last_name", { ascending: true });
    setPlayers(data ?? []);
    setLoading(false);
  }

  async function approvePlayer(id: string) {
    await supabase.from("profiles").update({ is_approved: true }).eq("id", id);
    loadPlayers();
  }

  function openEdit(player: Profile) {
    setEditingPlayer(player);
    setError("");
    setForm({
      first_name: player.first_name,
      last_name: player.last_name,
      jersey_number: player.jersey_number?.toString() ?? "",
      position: player.position,
      team_role: player.team_role,
      app_role: player.app_role,
      height: player.height?.toString() ?? "",
      weight: player.weight?.toString() ?? "",
      date_of_birth: player.date_of_birth ?? "",
      phone: player.phone ?? "",
      bio: player.bio ?? "",
      default_training_team: player.default_training_team ?? "none",
      is_active: player.is_active,
      is_approved: player.is_approved,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editingPlayer) return;
    setSaving(true);
    setError("");

    const { error: err } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
        position: form.position,
        team_role: form.team_role,
        app_role: form.app_role,
        height: form.height ? parseInt(form.height) : null,
        weight: form.weight ? parseInt(form.weight) : null,
        date_of_birth: form.date_of_birth || null,
        phone: form.phone || null,
        bio: form.bio || null,
        default_training_team: form.default_training_team === "none" ? null : form.default_training_team,
        is_active: form.is_active,
        is_approved: form.is_approved,
      })
      .eq("id", editingPlayer.id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setDialogOpen(false);
    setSaving(false);
    loadPlayers();
  }

  async function handlePositionChange(playerId: string, position: PlayerPosition) {
    await supabase.from("profiles").update({ position }).eq("id", playerId);
    loadPlayers();
  }

  const pending = players.filter((p) => !p.is_approved);
  const approved = players.filter((p) => p.is_approved);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("managePlayers")}</h1>

      {/* Edit Player Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("editPlayer")} — {editingPlayer?.first_name} {editingPlayer?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ime</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Prezime</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Broj dresa</Label>
                <Input
                  type="number"
                  value={form.jersey_number}
                  onChange={(e) => setForm({ ...form, jersey_number: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Pozicija</Label>
                <Select
                  value={form.position}
                  onValueChange={(v) => setForm({ ...form, position: v as PlayerPosition })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos} value={pos}>
                        {tp(pos)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Datum rodjenja</Label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Visina (cm)</Label>
                <Input
                  type="number"
                  value={form.height}
                  onChange={(e) => setForm({ ...form, height: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Tezina (kg)</Label>
                <Input
                  type="number"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bio</Label>
              <Input
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="bg-background"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Team Role</Label>
                <Select
                  value={form.team_role}
                  onValueChange={(v) => setForm({ ...form, team_role: v as PlayerRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">{tr("player")}</SelectItem>
                    <SelectItem value="captain">{tr("captain")}</SelectItem>
                    <SelectItem value="assistant_captain">{tr("assistantCaptain")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>App Role</Label>
                <Select
                  value={form.app_role}
                  onValueChange={(v) => setForm({ ...form, app_role: v as AppRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("defaultTeam")}</Label>
                <Select
                  value={form.default_training_team}
                  onValueChange={(v) => setForm({ ...form, default_training_team: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tt("noTeam")}</SelectItem>
                    <SelectItem value="team_a">{tt("teamA")}</SelectItem>
                    <SelectItem value="team_b">{tt("teamB")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_approved}
                  onChange={(e) => setForm({ ...form, is_approved: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Approved</span>
              </label>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || !form.first_name || !form.last_name}
              className="w-full bg-primary"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <Card className="border-yellow-500/20 mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {t("pendingApprovals")}
              <Badge className="bg-yellow-500/20 text-yellow-500">
                {pending.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pending.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between py-3 px-4 rounded-md bg-secondary/50"
                >
                  <div>
                    <p className="font-medium">
                      {player.first_name} {player.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {player.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(player)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approvePlayer(player.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {t("approve")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Players */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t("activePlayers")} ({approved.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Team Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approved.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="text-primary font-bold">
                    {player.jersey_number ?? "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {player.first_name} {player.last_name}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {player.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={player.position}
                      onValueChange={(v) =>
                        handlePositionChange(player.id, v as PlayerPosition)
                      }
                    >
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue>
                          <Badge className={`text-xs ${POSITION_COLORS[player.position as PlayerPosition]}`}>
                            {tp(player.position)}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {POSITIONS.map((pos) => (
                          <SelectItem key={pos} value={pos}>
                            {tp(pos)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {player.team_role === "captain"
                        ? tr("captain")
                        : player.team_role === "assistant_captain"
                          ? tr("assistantCaptain")
                          : tr("player")}
                    </span>
                  </TableCell>
                  <TableCell>
                    {player.is_active ? (
                      <Badge className="bg-green-600/20 text-green-400">Active</Badge>
                    ) : (
                      <Badge className="bg-red-600/20 text-red-400">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(player)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
