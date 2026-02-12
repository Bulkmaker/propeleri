"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { CheckCircle, Users, Loader2, Pencil, UserPlus, Upload, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import type { Profile, PlayerRole, AppRole, PlayerPosition, TrainingTeam } from "@/types/database";
import { POSITION_COLORS, POSITIONS } from "@/lib/utils/constants";
import imageCompression from "browser-image-compression";
import {
  extractLoginFromEmail,
  isSyntheticLoginEmail,
  isTechnicalPlayerEmail,
  normalizeLogin,
} from "@/lib/auth/login";
import { formatPlayerName } from "@/lib/utils/player-name";

interface PlayerForm {
  first_name: string;
  last_name: string;
  nickname: string;
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
  is_guest: boolean;
  is_active: boolean;
  is_approved: boolean;
}

type ActivePlayersSort = "name" | "number" | "position" | "training_team";
type SortDirection = "asc" | "desc";

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<Profile | null>(null);
  const [activeSort, setActiveSort] = useState<ActivePlayersSort>("name");
  const [activeSortDirection, setActiveSortDirection] = useState<SortDirection>("asc");
  const [pendingSort, setPendingSort] = useState<ActivePlayersSort>("name");
  const [pendingSortDirection, setPendingSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [createForm, setCreateForm] = useState({
    login: "",
    password: "",
    first_name: "",
    is_guest: false,
    jersey_number: "",
    position: "forward" as PlayerPosition,
  });
  const [credentialsForm, setCredentialsForm] = useState({
    login: "",
    password: "",
  });
  const [form, setForm] = useState<PlayerForm>({
    first_name: "",
    last_name: "",
    nickname: "",
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
    is_guest: false,
    is_active: true,
    is_approved: true,
  });

  const supabase = useMemo(() => createClient(), []);

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
  }, [supabase]);

  async function approvePlayer(id: string) {
    await supabase.from("profiles").update({ is_approved: true }).eq("id", id);
    loadPlayers();
  }

  async function deletePlayer(id: string, playerName: string) {
    if (!window.confirm(`${t("deletePlayerConfirm")} ${playerName}?`)) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadPlayers();
  }

  function openEdit(player: Profile) {
    setEditingPlayer(player);
    setError("");
    setCredentialsForm({
      login: "",
      password: "",
    });
    setForm({
      first_name: player.first_name,
      last_name: player.last_name,
      nickname: player.nickname ?? "",
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
      is_guest: player.is_guest ?? false,
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
        nickname: form.nickname.trim() || null,
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
        is_guest: form.is_guest,
        is_active: form.is_active,
        is_approved: form.is_approved,
      })
      .eq("id", editingPlayer.id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    const credentialsLogin = normalizeLogin(credentialsForm.login);
    const credentialsPassword = credentialsForm.password;
    const credentialsProvided = Boolean(credentialsLogin) || Boolean(credentialsPassword);
    if (credentialsProvided) {
      if (!credentialsLogin || !credentialsPassword) {
        setError(t("fillBothCredentials"));
        setSaving(false);
        return;
      }

      const credentialsRes = await fetch("/api/admin/players", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPlayer.id,
          login: credentialsLogin,
          password: credentialsPassword,
        }),
      });

      const credentialsData = await credentialsRes.json();
      if (!credentialsRes.ok) {
        setError(credentialsData.error || "Failed to update credentials");
        setSaving(false);
        return;
      }
    }

    setDialogOpen(false);
    setSaving(false);
    loadPlayers();
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingPlayer) return;

    setUploadingAvatar(true);
    setError("");

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      });

      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const filePath = `${editingPlayer.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressed, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", editingPlayer.id);

      if (updateError) throw updateError;

      setEditingPlayer((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
      setPlayers((prev) => prev.map((player) => (
        player.id === editingPlayer.id ? { ...player, avatar_url: publicUrl } : player
      )));
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }


  function openCreate() {
    setError("");
    setCreateForm({
      login: "",
      password: "",
      first_name: "",
      is_guest: false,
      jersey_number: "",
      position: "forward",
    });
    setCreateDialogOpen(true);
  }

  async function handleCreate() {
    setSaving(true);
    setError("");

    const login = normalizeLogin(createForm.login);
    const password = createForm.password;
    if ((login && !password) || (!login && password)) {
      setError(t("fillBothCredentials"));
      setSaving(false);
      return;
    }

    const res = await fetch("/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createForm,
        login: login || null,
        password: password || null,
      }),
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
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = useMemo(
    () => normalizeSearchValue(deferredSearchQuery),
    [deferredSearchQuery]
  );

  const sortPlayers = useMemo(
    () =>
      (source: Profile[], sortBy: ActivePlayersSort, direction: SortDirection) => {
        const sorted = [...source];
        const byName = (a: Profile, b: Profile) =>
          `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);

        const compare = (a: Profile, b: Profile) => {
          if (sortBy === "number") {
            if (a.jersey_number === null && b.jersey_number === null) return byName(a, b);
            if (a.jersey_number === null) return 1;
            if (b.jersey_number === null) return -1;
            return a.jersey_number - b.jersey_number || byName(a, b);
          }

          if (sortBy === "position") {
            const posDiff = POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position);
            return posDiff || byName(a, b);
          }

          if (sortBy === "training_team") {
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
        };

        sorted.sort((a, b) => {
          const value = compare(a, b);
          return direction === "desc" ? -value : value;
        });

        return sorted;
      },
    []
  );

  const sortedPending = useMemo(
    () => sortPlayers(pending, pendingSort, pendingSortDirection),
    [pending, pendingSort, pendingSortDirection, sortPlayers]
  );

  const sortedApproved = useMemo(
    () => sortPlayers(approved, activeSort, activeSortDirection),
    [approved, activeSort, activeSortDirection, sortPlayers]
  );

  const matchesPlayerSearch = useMemo(
    () =>
      (player: Profile) => {
        if (!normalizedSearchQuery) return true;

        const loginFromEmail = extractLoginFromEmail(player.email) ?? "";
        const searchableParts = [
          player.first_name,
          player.last_name,
          `${player.first_name} ${player.last_name}`,
          `${player.last_name} ${player.first_name}`,
          player.nickname ?? "",
          player.username ?? "",
          loginFromEmail,
          player.email,
          player.jersey_number?.toString() ?? "",
          player.position,
          player.default_training_team ?? "",
        ];

        return searchableParts.some((part) =>
          normalizeSearchValue(part).includes(normalizedSearchQuery)
        );
      },
    [normalizedSearchQuery]
  );

  const filteredPending = useMemo(
    () => sortedPending.filter(matchesPlayerSearch),
    [sortedPending, matchesPlayerSearch]
  );

  const filteredApproved = useMemo(
    () => sortedApproved.filter(matchesPlayerSearch),
    [sortedApproved, matchesPlayerSearch]
  );

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

  function renderPlayerLogin(player: Profile) {
    if (player.username) {
      return player.username;
    }

    const loginFromSyntheticEmail = extractLoginFromEmail(player.email);
    if (loginFromSyntheticEmail) {
      return loginFromSyntheticEmail;
    }

    if (isTechnicalPlayerEmail(player.email)) {
      return t("noLogin");
    }

    if (isSyntheticLoginEmail(player.email)) {
      return t("noLogin");
    }

    // Backward compatibility for legacy email-based accounts.
    return player.email;
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
      <AdminPageHeader title={t("managePlayers")}>
        <Button onClick={openCreate} className="bg-primary">
          <UserPlus className="h-4 w-4 mr-2" />
          {t("addPlayer")}
        </Button>
      </AdminPageHeader>

      <div className="p-6">
        <div className="mb-6">
          <div className="max-w-md space-y-2">
            <Label htmlFor="players-search">{tc("search")}</Label>
            <Input
              id="players-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background"
              placeholder={t("searchPlayersPlaceholder")}
            />
          </div>
        </div>
        {/* Edit Player Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t("editPlayer")}
                {editingPlayer ? ` — ${formatPlayerName(editingPlayer)}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {editingPlayer && (
                <div className="flex flex-col items-center gap-3 border border-border/60 rounded-lg p-4">
                  <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                    <AvatarImage src={editingPlayer.avatar_url ?? undefined} />
                    <AvatarFallback className="text-lg font-semibold">
                      {(editingPlayer.first_name?.[0] ?? "") + (editingPlayer.last_name?.[0] ?? "")}
                    </AvatarFallback>
                  </Avatar>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                    <Button variant="outline" size="sm" asChild disabled={uploadingAvatar}>
                      <span>
                        {uploadingAvatar ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {tpr("changeAvatar")}
                      </span>
                    </Button>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
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
                <div className="space-y-2">
                  <Label>{tpr("nickname")}</Label>
                  <Input
                    value={form.nickname}
                    onChange={(e) => setForm({ ...form, nickname: e.target.value })}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("loginField")}</Label>
                  <Input
                    value={credentialsForm.login}
                    onChange={(e) =>
                      setCredentialsForm({ ...credentialsForm, login: e.target.value })
                    }
                    placeholder={t("credentialsOptional")}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("loginPassword")}</Label>
                  <Input
                    type="text"
                    value={credentialsForm.password}
                    onChange={(e) =>
                      setCredentialsForm({ ...credentialsForm, password: e.target.value })
                    }
                    placeholder={t("credentialsOptional")}
                    className="bg-background"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("credentialsHint")}</p>

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
                    checked={form.is_guest}
                    onChange={(e) => setForm({ ...form, is_guest: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-sm">{tt("guest")}</span>
                </label>
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
                disabled={saving || !form.first_name.trim()}
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
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>{ta("firstName")}</Label>
                  <Input
                    value={createForm.first_name}
                    onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("loginField")}</Label>
                <Input
                  value={createForm.login}
                  onChange={(e) => setCreateForm({ ...createForm, login: e.target.value })}
                  className="bg-background"
                  placeholder={t("credentialsOptional")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("loginPassword")}</Label>
                <Input
                  type="text"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="bg-background"
                  placeholder={t("credentialsOptional")}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("credentialsHint")}</p>

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

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.is_guest}
                  onChange={(e) => setCreateForm({ ...createForm, is_guest: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">{tt("guest")}</span>
              </label>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button
                onClick={handleCreate}
                disabled={saving || !createForm.first_name.trim()}
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
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {t("pendingApprovals")}
                <Badge className="bg-yellow-500/20 text-yellow-500">
                  {filteredPending.length}
                  {normalizedSearchQuery ? `/${pending.length}` : ""}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="pending-players-sort" className="text-xs text-muted-foreground">
                  {t("sortBy")}
                </Label>
                <Select value={pendingSort} onValueChange={(value) => setPendingSort(value as ActivePlayersSort)}>
                  <SelectTrigger id="pending-players-sort" className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">{t("sortByName")}</SelectItem>
                    <SelectItem value="number">{t("sortByNumber")}</SelectItem>
                    <SelectItem value="position">{t("sortByPosition")}</SelectItem>
                    <SelectItem value="training_team">{t("sortByTrainingTeam")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={pendingSortDirection}
                  onValueChange={(value) => setPendingSortDirection(value as SortDirection)}
                >
                  <SelectTrigger id="pending-players-sort-direction" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">{t("sortAsc")}</SelectItem>
                    <SelectItem value="desc">{t("sortDesc")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredPending.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">{tc("noData")}</p>
                ) : (
                  filteredPending.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between py-3 px-4 rounded-md bg-secondary/50"
                    >
                      <div>
                        <p className="font-medium">
                          {formatPlayerName(player)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {renderPlayerLogin(player)}
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
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deletePlayer(player.id, formatPlayerName(player))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Players */}
        <Card className="border-border/40">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t("activePlayers")} ({filteredApproved.length}
              {normalizedSearchQuery ? `/${approved.length}` : ""})
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
              <Select
                value={activeSortDirection}
                onValueChange={(value) => setActiveSortDirection(value as SortDirection)}
              >
                <SelectTrigger id="active-players-sort-direction" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">{t("sortAsc")}</SelectItem>
                  <SelectItem value="desc">{t("sortDesc")}</SelectItem>
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
                {filteredApproved.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      {tc("noData")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApproved.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell className="text-primary font-bold">
                        {player.jersey_number ?? "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            {formatPlayerName(player)}
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
                          {player.is_guest && (
                            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40">
                              {tt("guest")}
                            </Badge>
                          )}
                        </div>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {renderPlayerLogin(player)}
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
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(player)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deletePlayer(player.id, formatPlayerName(player))}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
