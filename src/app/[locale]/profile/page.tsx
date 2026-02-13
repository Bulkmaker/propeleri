"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Save, Upload, User, Trash2, Plus } from "lucide-react";
import type { Profile, PlayerPosition } from "@/types/database";
import { POSITIONS } from "@/lib/utils/constants";
import { AvatarCropDialog } from "@/components/ui/avatar-crop-dialog";
import { processImageFile } from "@/lib/utils/image-processing";
import { CountrySelect } from "@/components/shared/CountrySelect";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tp = useTranslations("positions");
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setMessage("");

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
      setMessage(error.message);
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
      setMessage(err instanceof Error ? err.message : "Failed to process image");
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
      setMessage(err instanceof Error ? err.message : "Upload failed");
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

  if (!profile) return null;

  const initials = `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">{t("title")}</h1>

      <Card className="border-border/40">
        <CardContent className="p-6">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <Avatar className="h-24 w-24 ring-4 ring-primary/20 mb-4">
              <AvatarImage src={profile.avatar_url ?? undefined} alt={`${profile.first_name} ${profile.last_name}`} />
              <AvatarFallback className="bg-secondary text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span>
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {t("changeAvatar")}
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
              title={t("cropAvatar")}
              saveLabel={t("cropSave")}
              cancelLabel={tc("cancel")}
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("title") === "Moj profil" ? "Ime" : "First Name"}</Label>
                <Input
                  value={profile.first_name}
                  onChange={(e) =>
                    setProfile({ ...profile, first_name: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("title") === "Moj profil" ? "Prezime" : "Last Name"}</Label>
                <Input
                  value={profile.last_name}
                  onChange={(e) =>
                    setProfile({ ...profile, last_name: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("nickname")}</Label>
                <Input
                  value={profile.nickname ?? ""}
                  onChange={(e) =>
                    setProfile({ ...profile, nickname: e.target.value || null })
                  }
                  className="bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("jerseyNumber")}</Label>
                <Input
                  type="number"
                  value={profile.jersey_number ?? ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      jersey_number: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("position")}</Label>
                <Select
                  value={profile.position}
                  onValueChange={(v) =>
                    setProfile({
                      ...profile,
                      position: v as PlayerPosition,
                    })
                  }
                >
                  <SelectTrigger className="bg-background">
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

            <div className="space-y-2">
              <Label>{t("bio")}</Label>
              <Input
                value={profile.bio ?? ""}
                onChange={(e) =>
                  setProfile({ ...profile, bio: e.target.value || null })
                }
                className="bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("height")}</Label>
                <Input
                  type="number"
                  value={profile.height ?? ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      height: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("weight")}</Label>
                <Input
                  type="number"
                  value={profile.weight ?? ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      weight: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("phone")}</Label>
                <Input
                  value={profile.phone ?? ""}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value || null })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("dateOfBirth")}</Label>
                <Input
                  type="date"
                  value={profile.date_of_birth ?? ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      date_of_birth: e.target.value || null,
                    })
                  }
                  className="bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("nationality")}</Label>
                <div className="flex gap-2">
                  <CountrySelect
                    value={profile.nationality}
                    onChange={(val) => setProfile({ ...profile, nationality: val })}
                    className="bg-background"
                  />
                  {!profile.second_nationality && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setProfile({ ...profile, second_nationality: "none" })}
                      className="shrink-0 text-muted-foreground"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {profile.second_nationality !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("secondNationality")}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 text-muted-foreground hover:text-destructive"
                      onClick={() => setProfile({ ...profile, second_nationality: null })}
                    >
                      <span className="sr-only">{tc("delete")}</span>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <CountrySelect
                    value={profile.second_nationality === "none" ? null : profile.second_nationality}
                    onChange={(val) => setProfile({ ...profile, second_nationality: val })}
                    className="bg-background"
                  />
                </div>
              )}
            </div>

            {message && (
              <p
                className={`text-sm px-3 py-2 rounded-md ${message === t("saved")
                  ? "text-green-400 bg-green-400/10 border border-green-400/20"
                  : "text-destructive bg-destructive/10 border border-destructive/20"
                  }`}
              >
                {message}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {tc("save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
