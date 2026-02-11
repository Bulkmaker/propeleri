"use client";

import { useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Save, Upload, User } from "lucide-react";
import type { Profile, PlayerPosition } from "@/types/database";
import { POSITIONS } from "@/lib/utils/constants";
import imageCompression from "browser-image-compression";

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
  const [message, setMessage] = useState("");
  const [isApproved, setIsApproved] = useState(true);

  const supabase = createClient();

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
  }, []);

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
        jersey_number: profile.jersey_number,
        position: profile.position,
        bio: profile.bio,
        phone: profile.phone,
        date_of_birth: profile.date_of_birth,
        height: profile.height,
        weight: profile.weight,
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(t("saved"));
    }
    setSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    try {
      // Compress image
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      });

      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const filePath = `${profile.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressed, { upsert: true });

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
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-secondary text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
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
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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

            {message && (
              <p
                className={`text-sm px-3 py-2 rounded-md ${
                  message === t("saved")
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
