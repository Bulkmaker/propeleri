"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Pencil, Loader2, Upload, Trash2 } from "lucide-react";
import { POSITIONS } from "@/lib/utils/constants";
import { AvatarCropDialog } from "@/components/ui/avatar-crop-dialog";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { normalizeLogin } from "@/lib/auth/login";
import { formatPlayerName } from "@/lib/utils/player-name";
import { processImageFile } from "@/lib/utils/image-processing";
import { cn } from "@/lib/utils";
import type { Profile, PlayerRole, AppRole, PlayerPosition, TrainingTeam } from "@/types/database";

interface PlayerForm {
  first_name: string;
  last_name: string;
  nickname: string;
  jersey_number: string;
  position: PlayerPosition | null;
  team_role: PlayerRole;
  app_role: AppRole;
  height: string;
  weight: string;
  date_of_birth: string;
  phone: string;
  bio: string;
  nationality: string | null;
  second_nationality: string | null;
  default_training_team: string;
  is_guest: boolean;
  is_active: boolean;
  is_approved: boolean;
}

interface PlayerEditButtonProps {
  playerId: string;
  variant?: "icon" | "button";
  className?: string;
  onSaved?: () => void;
}

function formFromPlayer(player: Profile): PlayerForm {
  return {
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
    nationality: player.nationality,
    second_nationality: player.second_nationality,
    default_training_team: player.default_training_team ?? "none",
    is_guest: player.is_guest ?? false,
    is_active: player.is_active,
    is_approved: player.is_approved,
  };
}

export function PlayerEditButton({
  playerId,
  variant = "icon",
  className,
  onSaved,
}: PlayerEditButtonProps) {
  const { isAdmin, isTeamLeader } = useUser();
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);

  if (!isAdmin && !isTeamLeader) return null;

  const trigger =
    variant === "button" ? (
      <Button
        variant="outline"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4 mr-2" />
        {tc("edit")}
      </Button>
    ) : (
      <Button
        variant="ghost"
        size="icon-xs"
        className={cn(
          "text-muted-foreground hover:text-primary hover:bg-primary/10",
          className
        )}
        onClick={() => setOpen(true)}
        aria-label={tc("edit")}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    );

  return (
    <>
      {trigger}
      {open && (
        <PlayerEditDialogInner
          playerId={playerId}
          open={open}
          onOpenChange={setOpen}
          onSaved={onSaved}
          showCredentials={isAdmin}
        />
      )}
    </>
  );
}

function PlayerEditDialogInner({
  playerId,
  open,
  onOpenChange,
  onSaved,
  showCredentials,
}: {
  playerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  showCredentials: boolean;
}) {
  const t = useTranslations("admin");
  const tp = useTranslations("positions");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const tt = useTranslations("training");
  const ta = useTranslations("auth");
  const tpr = useTranslations("profile");

  const supabase = useMemo(() => createClient(), []);
  const [player, setPlayer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
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
    nationality: null,
    second_nationality: null,
    default_training_team: "none",
    is_guest: false,
    is_active: true,
    is_approved: true,
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", playerId)
        .single();
      if (!mounted) return;
      if (data) {
        setPlayer(data as Profile);
        setForm(formFromPlayer(data as Profile));
      }
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [playerId, supabase]);

  async function handleSave() {
    if (!player) return;
    setSaving(true);
    setError("");

    const { error: err } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        nickname: form.nickname.trim() || null,
        jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
        position: form.position || null,
        team_role: form.team_role,
        app_role: form.app_role,
        height: form.height ? parseInt(form.height) : null,
        weight: form.weight ? parseInt(form.weight) : null,
        date_of_birth: form.date_of_birth || null,
        phone: form.phone || null,
        bio: form.bio || null,
        nationality: form.nationality,
        second_nationality: form.second_nationality,
        default_training_team:
          form.default_training_team === "none"
            ? null
            : form.default_training_team,
        is_guest: form.is_guest,
        is_active: form.is_active,
        is_approved: form.is_approved,
      })
      .eq("id", player.id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    if (showCredentials) {
      const credLogin = normalizeLogin(credentialsForm.login);
      const credPassword = credentialsForm.password;
      const credProvided = Boolean(credLogin) || Boolean(credPassword);
      if (credProvided) {
        if (!credLogin || !credPassword) {
          setError(t("fillBothCredentials"));
          setSaving(false);
          return;
        }

        const res = await fetch("/api/admin/players", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: player.id,
            login: credLogin,
            password: credPassword,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to update credentials");
          setSaving(false);
          return;
        }
      }
    }

    onOpenChange(false);
    setSaving(false);
    onSaved?.();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      const processedFile = await processImageFile(file);
      const url = URL.createObjectURL(processedFile);
      setCropImageSrc(url);
      setCropDialogOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process image");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function handleCroppedUpload(blob: Blob) {
    if (!player) return;

    setUploadingAvatar(true);
    setError("");

    try {
      const filePath = `${player.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", player.id);

      if (updateError) throw updateError;

      setPlayer((prev) =>
        prev ? { ...prev, avatar_url: publicUrl } : prev
      );
    } catch (uploadError: unknown) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload avatar"
      );
    } finally {
      setUploadingAvatar(false);
      setCropDialogOpen(false);
      if (cropImageSrc) {
        URL.revokeObjectURL(cropImageSrc);
        setCropImageSrc(null);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t("editPlayer")}
            {player ? ` — ${formatPlayerName(player)}` : ""}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !player ? (
          <p className="text-sm text-destructive py-4">{tc("noData")}</p>
        ) : (
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 border border-border/60 rounded-lg p-4">
              <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                <AvatarImage src={player.avatar_url ?? undefined} />
                <AvatarFallback className="text-lg font-semibold">
                  {(player.first_name?.[0] ?? "") +
                    (player.last_name?.[0] ?? "")}
                </AvatarFallback>
              </Avatar>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={uploadingAvatar}
                />
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={uploadingAvatar}
                >
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
              <AvatarCropDialog
                open={cropDialogOpen}
                imageSrc={cropImageSrc}
                onClose={() => {
                  setCropDialogOpen(false);
                  if (cropImageSrc) {
                    URL.revokeObjectURL(cropImageSrc);
                    setCropImageSrc(null);
                  }
                }}
                onConfirm={handleCroppedUpload}
                title={tpr("cropAvatar")}
                saveLabel={tpr("cropSave")}
                cancelLabel={tc("cancel")}
              />
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{ta("firstName")}</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) =>
                    setForm({ ...form, first_name: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{ta("lastName")}</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) =>
                    setForm({ ...form, last_name: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{tpr("nickname")}</Label>
                <Input
                  value={form.nickname}
                  onChange={(e) =>
                    setForm({ ...form, nickname: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
            </div>

            {/* Jersey, Position, DOB */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{tpr("jerseyNumber")}</Label>
                <Input
                  type="number"
                  value={form.jersey_number}
                  onChange={(e) =>
                    setForm({ ...form, jersey_number: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{tpr("position")}</Label>
                <Select
                  value={form.position ?? "none"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      position:
                        v === "none" ? null : (v as PlayerPosition),
                    })
                  }
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
                    <SelectItem value="none">{t("noPosition")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tpr("dateOfBirth")}</Label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) =>
                    setForm({ ...form, date_of_birth: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
            </div>

            {/* Height, Weight, Nationality */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{tpr("height")}</Label>
                <Input
                  type="number"
                  value={form.height}
                  onChange={(e) =>
                    setForm({ ...form, height: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{tpr("weight")}</Label>
                <Input
                  type="number"
                  value={form.weight}
                  onChange={(e) =>
                    setForm({ ...form, weight: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{tpr("nationality")}</Label>
                  <CountrySelect
                    value={form.nationality}
                    onChange={(val) => setForm({ ...form, nationality: val })}
                    className="bg-background"
                  />
                </div>
                {!form.second_nationality && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({ ...form, second_nationality: "none" })
                    }
                    className="gap-2 text-muted-foreground w-full"
                  >
                    <span className="text-lg leading-none">+</span>
                    {tpr("secondNationality")}
                  </Button>
                )}
                {form.second_nationality !== null && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{tpr("secondNationality")}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setForm({ ...form, second_nationality: null })
                        }
                      >
                        <span className="sr-only">{tc("delete")}</span>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <CountrySelect
                      value={
                        form.second_nationality === "none"
                          ? null
                          : form.second_nationality
                      }
                      onChange={(val) =>
                        setForm({ ...form, second_nationality: val })
                      }
                      className="bg-background"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>{tpr("phone")}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label>{tpr("bio")}</Label>
              <Input
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="bg-background"
              />
            </div>

            {/* Credentials (admin only) */}
            {showCredentials && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("loginField")}</Label>
                    <Input
                      value={credentialsForm.login}
                      onChange={(e) =>
                        setCredentialsForm({
                          ...credentialsForm,
                          login: e.target.value,
                        })
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
                        setCredentialsForm({
                          ...credentialsForm,
                          password: e.target.value,
                        })
                      }
                      placeholder={t("credentialsOptional")}
                      className="bg-background"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("credentialsHint")}
                </p>
              </>
            )}

            {/* Roles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("teamRoleColumn")}</Label>
                <Select
                  value={form.team_role}
                  onValueChange={(v) =>
                    setForm({ ...form, team_role: v as PlayerRole })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">{tr("player")}</SelectItem>
                    <SelectItem value="captain">{tr("captain")}</SelectItem>
                    <SelectItem value="assistant_captain">
                      {tr("assistantCaptain")}
                    </SelectItem>
                    <SelectItem value="coach">{tr("coach")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("appRole")}</Label>
                <Select
                  value={form.app_role}
                  onValueChange={(v) =>
                    setForm({ ...form, app_role: v as AppRole })
                  }
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
                  onValueChange={(v) =>
                    setForm({ ...form, default_training_team: v })
                  }
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

            {/* Flags */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_guest}
                  onChange={(e) =>
                    setForm({ ...form, is_guest: e.target.checked })
                  }
                  className="rounded border-border"
                />
                <span className="text-sm">{tt("guest")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                  className="rounded border-border"
                />
                <span className="text-sm">{t("active")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_approved}
                  onChange={(e) =>
                    setForm({ ...form, is_approved: e.target.checked })
                  }
                  className="rounded border-border"
                />
                <span className="text-sm">{t("approved")}</span>
              </label>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            {/* Save */}
            <Button
              onClick={handleSave}
              disabled={saving || !form.first_name.trim()}
              className="w-full bg-primary"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc("save")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
