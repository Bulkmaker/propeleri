"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Plus, Loader2, Upload } from "lucide-react";
import type { GalleryAlbum } from "@/types/database";
import imageCompression from "browser-image-compression";
import { processImageFile } from "@/lib/utils/image-processing";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { LoadingErrorEmpty } from "@/components/shared/LoadingErrorEmpty";
import { useAdminData } from "@/hooks/use-admin-data";

export default function AdminGalleryPage() {
  const t = useTranslations("admin");
  const tg = useTranslations("gallery");
  const tc = useTranslations("common");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    title_ru: "",
    title_en: "",
    description: "",
  });

  const queryFn = useCallback(
    (sb: Parameters<Parameters<typeof useAdminData>[0]>[0]) =>
      sb
        .from("gallery_albums")
        .select("*, photos:gallery_photos(count)")
        .order("created_at", { ascending: false }),
    []
  );

  const { data: albums, loading, error, reload, supabase } =
    useAdminData<GalleryAlbum & { photos: [{ count: number }] }>(queryFn);

  async function handleCreateAlbum() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("gallery_albums").insert({
      ...form,
      created_by: user?.id,
    });

    setDialogOpen(false);
    setSaving(false);
    setForm({ title: "", title_ru: "", title_en: "", description: "" });
    await reload();
  }

  async function handlePhotoUpload(albumId: string, files: FileList) {
    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    for (const [index, file] of Array.from(files).entries()) {
      const processedFile = await processImageFile(file);
      const compressed = await imageCompression(processedFile, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const safeName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-");
      const filePath = `${user?.id}/${safeName}-${file.lastModified}-${index}.${ext}`;

      const { error } = await supabase.storage
        .from("gallery")
        .upload(filePath, compressed);

      if (!error) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("gallery").getPublicUrl(filePath);

        await supabase.from("gallery_photos").insert({
          album_id: albumId,
          image_url: publicUrl,
          uploaded_by: user?.id,
        });
      }
    }

    setUploading(false);
    await reload();
  }

  return (
    <LoadingErrorEmpty loading={loading} error={error} isEmpty={albums.length === 0} onRetry={reload}>
      <div>
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("manageGallery")}</h1>
          <AdminDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title={t("newAlbum")}
            saving={saving}
            disabled={!form.title}
            onSave={handleCreateAlbum}
            trigger={
              <Button onClick={() => setDialogOpen(true)} className="bg-primary">
                <Plus className="h-4 w-4 mr-2" />
                {t("newAlbum")}
              </Button>
            }
          >
            <div className="space-y-2">
              <Label>{t("titleSr")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("titleRu")}</Label>
                <Input
                  value={form.title_ru}
                  onChange={(e) => setForm({ ...form, title_ru: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("titleEn")}</Label>
                <Input
                  value={form.title_en}
                  onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>
          </AdminDialog>
        </div>

        <div className="p-6 space-y-2">
          {albums.map((album) => (
            <Card key={album.id} className="border-border/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Camera className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="font-medium text-sm">{album.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {album.photos?.[0]?.count ?? 0}{" "}
                      {tg("photos").toLowerCase()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          handlePhotoUpload(album.id, e.target.files);
                        }
                      }}
                      disabled={uploading}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      disabled={uploading}
                    >
                      <span>
                        {uploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {tg("uploadPhotos")}
                      </span>
                    </Button>
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </LoadingErrorEmpty>
  );
}
