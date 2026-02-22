"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Loader2 } from "lucide-react";
import { PlayerEditForm } from "@/components/shared/PlayerEditForm";
import type { PlayerFormData, AdminFields } from "@/components/shared/PlayerEditForm";
import { normalizeLogin } from "@/lib/auth/login";
import { formatPlayerName } from "@/lib/utils/player-name";
import { processImageFile } from "@/lib/utils/image-processing";
import { cn } from "@/lib/utils";
import { SlugField } from "@/components/admin/SlugField";
import { buildProfileSlug } from "@/lib/utils/match-slug";
import type { Profile } from "@/types/database";

function formFromPlayer(player: Profile): PlayerFormData {
  return {
    first_name: player.first_name,
    last_name: player.last_name,
    nickname: player.nickname ?? "",
    jersey_number: player.jersey_number?.toString() ?? "",
    position: player.position,
    default_training_team: player.default_training_team ?? "none",
    height: player.height?.toString() ?? "",
    weight: player.weight?.toString() ?? "",
    date_of_birth: player.date_of_birth ?? "",
    nationality: player.nationality,
    second_nationality: player.second_nationality,
    phone: player.phone ?? "",
    bio: player.bio ?? "",
  };
}

function adminFromPlayer(player: Profile): AdminFields {
  return {
    login: "",
    password: "",
    team_role: player.team_role,
    app_role: player.app_role,
    can_play_goalie: player.can_play_goalie ?? false,
    is_guest: player.is_guest ?? false,
    is_active: player.is_active,
    is_approved: player.is_approved,
  };
}

interface PlayerEditButtonProps {
  playerId: string;
  variant?: "icon" | "button";
  className?: string;
  onSaved?: () => void;
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
  const tc = useTranslations("common");

  const supabase = useMemo(() => createClient(), []);
  const [player, setPlayer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const [form, setForm] = useState<PlayerFormData>({
    first_name: "",
    last_name: "",
    nickname: "",
    jersey_number: "",
    position: "forward",
    default_training_team: "none",
    height: "",
    weight: "",
    date_of_birth: "",
    nationality: null,
    second_nationality: null,
    phone: "",
    bio: "",
  });

  const [playerSlug, setPlayerSlug] = useState("");

  const [adminFields, setAdminFields] = useState<AdminFields>({
    login: "",
    password: "",
    team_role: "player",
    app_role: "player",
    can_play_goalie: false,
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
        const p = data as Profile;
        setPlayer(p);
        setForm(formFromPlayer(p));
        setPlayerSlug(p.slug);
        setAdminFields(adminFromPlayer(p));
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
        slug: playerSlug,
        nickname: form.nickname.trim() || null,
        jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
        position: form.position || null,
        team_role: adminFields.team_role,
        app_role: adminFields.app_role,
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
        can_play_goalie: form.position === "goalie" ? false : adminFields.can_play_goalie,
        is_guest: adminFields.is_guest,
        is_active: adminFields.is_active,
        is_approved: adminFields.is_approved,
      })
      .eq("id", player.id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    if (showCredentials) {
      const credLogin = normalizeLogin(adminFields.login);
      const credPassword = adminFields.password;
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
          <>
          <SlugField
            value={playerSlug}
            onChange={setPlayerSlug}
            onRegenerate={() =>
              setPlayerSlug(buildProfileSlug({ firstName: form.first_name, lastName: form.last_name }))
            }
            table="profiles"
            excludeId={player.id}
            baseUrl="/roster"
          />
          <PlayerEditForm
            avatarUrl={player.avatar_url}
            avatarInitials={
              (player.first_name?.[0] ?? "") + (player.last_name?.[0] ?? "")
            }
            onAvatarFileSelect={handleFileSelect}
            uploadingAvatar={uploadingAvatar}
            cropDialogOpen={cropDialogOpen}
            cropImageSrc={cropImageSrc}
            onCropClose={() => {
              setCropDialogOpen(false);
              if (cropImageSrc) {
                URL.revokeObjectURL(cropImageSrc);
                setCropImageSrc(null);
              }
            }}
            onCropConfirm={handleCroppedUpload}
            form={form}
            onFormChange={(updated) => setForm(updated)}
            adminFields={showCredentials ? adminFields : undefined}
            onAdminFieldsChange={
              showCredentials ? (fields) => setAdminFields(fields) : undefined
            }
            onSave={handleSave}
            saving={saving}
            error={error}
            saveDisabled={!form.first_name.trim()}
          />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
