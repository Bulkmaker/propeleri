"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { CheckCircle, Users, Loader2, Pencil, UserPlus } from "lucide-react";
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

type ActivePlayersSort = "name" | "number" | "position" | "training_team";

export default function AdminPlayersPage() {
  const locale = useLocale();
  const t = useTranslations("admin");
  const tp = useTranslations("positions");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const tt = useTranslations("training");
  const ta = useTranslations("auth");
  const tpr = useTranslations("profile");

  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null);
  const [activeSort, setActiveSort] = useState<ActivePlayersSort>("name");
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    jersey_number: "",
    position: "forward" as PlayerPosition,
  });
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

  async function loadPlayers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("is_approved", { ascending: true })
      .order("last_name", { ascending: true });
    setPlayers(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialPlayers() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("is_approved", { ascending: true })
        .order("last_name", { ascending: true });

      if (!isMounted) return;
      setPlayers(data ?? []);
      setLoading(false);
    }

    void loadInitialPlayers();

    return () => {
      isMounted = false;
    };
  }, []);

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


  function openCreate() {
    setError("");
    setCreateForm({
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      jersey_number: "",
      position: "forward",
    });
    setCreateDialogOpen(true);
  }

  async function handleCreate() {
    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create player");
      setSaving(false);
      return;
    }

    setCreateDialogOpen(false);
    setSaving(false);
    loadPlayers();
  }

  const pending = useMemo(() => players.filter((p) => !p.is_approved), [players]);
  const approved = useMemo(() => players.filter((p) => p.is_approved), [players]);
  const sortedApproved = useMemo(() => {
    const sorted = [...approved];
    const byName = (a: Profile, b: Profile) =>
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);

    sorted.sort((a, b) => {
      if (activeSort === "number") {
        if (a.jersey_number === null && b.jersey_number === null) return byName(a, b);
        if (a.jersey_number === null) return 1;
        if (b.jersey_number === null) return -1;
        return a.jersey_number - b.jersey_number || byName(a, b);
      }

      if (activeSort === "position") {
        const posDiff = POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position);
        return posDiff || byName(a, b);
      }

      if (activeSort === "training_team") {
        const teamRank: Record<TrainingTeam | "none", number> = {
          team_a: 0,
          team_b: 1,
          none: 2,
        };
        const aTeam = a.default_training_team ?? "none";
        const bTeam = b.default_training_team ?? "none";
        return teamRank[aTeam] - teamRank[bTeam] || byName(a, b);
      }

      return byName(a, b);
    });

    return sorted;
  }, [approved, activeSort]);

  function formatDateOfBirth(dateOfBirth: string | null) {
    if (!dateOfBirth) return "-";
    const parsed = new Date(`${dateOfBirth}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateOfBirth;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(parsed);
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
        <h1 className="text-2xl font-bold">{t("managePlayers")}</h1>
        <Button onClick={openCreate} className="bg-primary">
          <UserPlus className="h-4 w-4 mr-2" />
          {t("addPlayer")}
        </Button>
      </div>

      <div className="p-6">
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
                <Label>{ta("firstName")}</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{ta("lastName")}</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{tpr("jerseyNumber")}</Label>
                <Input
                  type="number"
                  value={form.jersey_number}
                  onChange={(e) => setForm({ ...form, jersey_number: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{tpr("position")}</Label>
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
                <Label>{tpr("dateOfBirth")}</Label>
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
                <Label>{tpr("height")}</Label>
                <Input
                  type="number"
                  value={form.height}
                  onChange={(e) => setForm({ ...form, height: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{tpr("weight")}</Label>
                <Input
                  type="number"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{tpr("phone")}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tpr("bio")}</Label>
              <Input
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="bg-background"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("teamRoleColumn")}</Label>
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
                <Label>{t("appRole")}</Label>
                <Select
                  value={form.app_role}
                  onValueChange={(v) => setForm({ ...form, app_role: v as AppRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">{tr("player")}</SelectItem>
                    <SelectItem value="admin">{tc("admin")}</SelectItem>
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
                <span className="text-sm">{t("active")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_approved}
                  onChange={(e) => setForm({ ...form, is_approved: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">{t("approved")}</span>
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

      {/* Create Player Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t("addPlayerTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{ta("firstName")}</Label>
                <Input
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{ta("lastName")}</Label>
                <Input
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{ta("email")}</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label>{ta("password")}</Label>
              <Input
                type="text"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="bg-background"
                placeholder={t("minPasswordChars")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tpr("jerseyNumber")}</Label>
                <Input
                  type="number"
                  value={createForm.jersey_number}
                  onChange={(e) => setCreateForm({ ...createForm, jersey_number: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{tpr("position")}</Label>
                <Select
                  value={createForm.position}
                  onValueChange={(v) => setCreateForm({ ...createForm, position: v as PlayerPosition })}
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
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <Button
              onClick={handleCreate}
              disabled={saving || !createForm.first_name || !createForm.last_name || !createForm.email || !createForm.password}
              className="w-full bg-primary"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc("create")}
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
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t("activePlayers")} ({approved.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="active-players-sort" className="text-xs text-muted-foreground">
              {t("sortBy")}
            </Label>
            <Select value={activeSort} onValueChange={(value) => setActiveSort(value as ActivePlayersSort)}>
              <SelectTrigger id="active-players-sort" className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t("sortByName")}</SelectItem>
                <SelectItem value="number">{t("sortByNumber")}</SelectItem>
                <SelectItem value="position">{t("sortByPosition")}</SelectItem>
                <SelectItem value="training_team">{t("sortByTrainingTeam")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>{t("playerColumn")}</TableHead>
                <TableHead>{t("positionColumn")}</TableHead>
                <TableHead>{t("trainingTeamColumn")}</TableHead>
                <TableHead>{tpr("dateOfBirth")}</TableHead>
                <TableHead className="text-center">{t("statusColumn")}</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedApproved.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="text-primary font-bold">
                    {player.jersey_number ?? "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        {player.first_name} {player.last_name}
                      </span>
                      {player.team_role === "captain" && (
                        <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40">
                          {tr("captain")}
                        </Badge>
                      )}
                      {player.team_role === "assistant_captain" && (
                        <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/40">
                          {tr("assistantCaptain")}
                        </Badge>
                      )}
                    </div>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {player.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${POSITION_COLORS[player.position as PlayerPosition]}`}>
                      {tp(player.position)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {player.default_training_team ? (
                      <Badge variant="outline" className="text-xs">
                        {player.default_training_team === "team_a" ? tt("teamA") : tt("teamB")}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">{tt("noTeam")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDateOfBirth(player.date_of_birth)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${player.is_active ? "bg-green-500" : "bg-red-500"}`}
                        aria-label={player.is_active ? t("active") : t("inactive")}
                        title={player.is_active ? t("active") : t("inactive")}
                      />
                    </div>
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
    </div>
  );
}
