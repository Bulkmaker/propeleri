"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, User } from "lucide-react";
import type { Profile } from "@/types/database";
import { processImageFile } from "@/lib/utils/image-processing";
import { PlayerEditForm, type PlayerFormData } from "@/components/shared/PlayerEditForm";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isApproved, setIsApproved] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setIsApproved(data.is_approved);
      }
      setLoading(false);
    }
    load();
  }, [router, supabase]);

  /* Convert Profile → PlayerFormData */
  const formData: PlayerFormData | null = profile
    ? {
        first_name: profile.first_name,
        last_name: profile.last_name,
        nickname: profile.nickname ?? "",
        jersey_number: profile.jersey_number?.toString() ?? "",
        position: profile.position,
        default_training_team: profile.default_training_team ?? "none",
        height: profile.height?.toString() ?? "",
        weight: profile.weight?.toString() ?? "",
        date_of_birth: profile.date_of_birth ?? "",
        nationality: profile.nationality,
        second_nationality: profile.second_nationality,
        phone: profile.phone ?? "",
        bio: profile.bio ?? "",
      }
    : null;

  function handleFormChange(updated: PlayerFormData) {
    if (!profile) return;
    setProfile({
      ...profile,
      first_name: updated.first_name,
      last_name: updated.last_name,
      nickname: updated.nickname || null,
      jersey_number: updated.jersey_number ? parseInt(updated.jersey_number) : null,
      position: updated.position,
      height: updated.height ? parseInt(updated.height) : null,
      weight: updated.weight ? parseInt(updated.weight) : null,
      date_of_birth: updated.date_of_birth || null,
      nationality: updated.nationality,
      second_nationality: updated.second_nationality,
      phone: updated.phone || null,
      bio: updated.bio || null,
    });
  }

  async function handleSave() {
    if (!profile) return;

    setSaving(true);
    setMessage("");
    setErrorMsg("");

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        nickname: profile.nickname,
        jersey_number: profile.jersey_number,
        position: profile.position,
        bio: profile.bio,
        phone: profile.phone,
        date_of_birth: profile.date_of_birth,
        height: profile.height,
        weight: profile.weight,
        nationality: profile.nationality,
        second_nationality: profile.second_nationality,
      })
      .eq("id", profile.id);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setMessage(t("saved"));
    }
    setSaving(false);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const processedFile = await processImageFile(file);
      const url = URL.createObjectURL(processedFile);
      setCropImageSrc(url);
      setCropDialogOpen(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to process image");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleCroppedUpload(blob: Blob) {
    if (!profile) return;

    setUploading(true);
    try {
      const filePath = `${profile.id}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);

      setProfile({ ...profile, avatar_url: publicUrl });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
    setCropDialogOpen(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/40">
          <CardContent className="pt-8 text-center">
            <User className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{ta("awaitingApproval")}</h2>
            <p className="text-muted-foreground text-sm">
              {ta("approvalMessage")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile && !loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border/40">
          <CardContent className="pt-8 text-center text-card-foreground">
            <User className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{tc("noData")}</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {t("notFound")}
            </p>
            <Button
              variant="outline"
              className="border-primary/30"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
            >
              {tc("logout")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile || !formData) return null;

  const initials = `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <h1 className="text-3xl font-bold mb-8">{t("title")}</h1>

      <Card className="border-border/40">
        <CardContent className="p-6">
          <PlayerEditForm
            avatarUrl={profile.avatar_url}
            avatarInitials={initials}
            onAvatarFileSelect={handleFileSelect}
            uploadingAvatar={uploading}
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
            form={formData}
            onFormChange={handleFormChange}
            onSave={handleSave}
            saving={saving}
            error={errorMsg}
            successMessage={message}
          />
        </CardContent>
      </Card>
    </div>
  );
}
