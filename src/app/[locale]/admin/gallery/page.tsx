"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Plus, Loader2, Upload } from "lucide-react";
import type { GalleryAlbum } from "@/types/database";
import imageCompression from "browser-image-compression";

export default function AdminGalleryPage() {
  const t = useTranslations("admin");
  const tg = useTranslations("gallery");
  const tc = useTranslations("common");

  const [albums, setAlbums] = useState<(GalleryAlbum & { photos: [{ count: number }] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    title_ru: "",
    title_en: "",
    description: "",
  });

  const supabase = createClient();

  async function loadData() {
    const { data } = await supabase
      .from("gallery_albums")
      .select("*, photos:gallery_photos(count)")
      .order("created_at", { ascending: false });
    setAlbums(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    async function loadInitialData() {
      const { data } = await supabase
        .from("gallery_albums")
        .select("*, photos:gallery_photos(count)")
        .order("created_at", { ascending: false });
      setAlbums(data ?? []);
      setLoading(false);
    }

    void loadInitialData();
  }, []);

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
    loadData();
  }

  async function handlePhotoUpload(
    albumId: string,
    files: FileList
  ) {
    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    for (const [index, file] of Array.from(files).entries()) {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      const ext = compressed.type === "image/png" ? "png" : "jpg";
      const safeName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-");
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
    setSelectedAlbum(null);
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
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("manageGallery")}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary">
              <Plus className="h-4 w-4 mr-2" />
              Novi album
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Novi album</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Naslov (SR)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Naslov (RU)</Label>
                  <Input
                    value={form.title_ru}
                    onChange={(e) =>
                      setForm({ ...form, title_ru: e.target.value })
                    }
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Naslov (EN)</Label>
                  <Input
                    value={form.title_en}
                    onChange={(e) =>
                      setForm({ ...form, title_en: e.target.value })
                    }
                    className="bg-background"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreateAlbum}
                disabled={saving || !form.title}
                className="w-full bg-primary"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tc("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
                    {album.photos?.[0]?.count ?? 0} {tg("photos").toLowerCase()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        handlePhotoUpload(album.id, e.target.files);
                      }
                    }}
                    disabled={uploading}
                  />
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
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
  );
}
