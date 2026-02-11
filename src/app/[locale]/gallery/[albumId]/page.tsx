"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, X, ChevronRight as ChevronRightIcon, ChevronLeft as ChevronLeftIcon } from "lucide-react";
import type { GalleryPhoto, GalleryAlbum } from "@/types/database";

export default function AlbumDetailPage() {
  const params = useParams();
  const albumId = params.albumId as string;
  const tc = useTranslations("common");

  const [album, setAlbum] = useState<GalleryAlbum | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: albumData } = await supabase
        .from("gallery_albums")
        .select("*")
        .eq("id", albumId)
        .single();

      const { data: photosData } = await supabase
        .from("gallery_photos")
        .select("*")
        .eq("album_id", albumId)
        .order("sort_order", { ascending: true });

      setAlbum(albumData);
      setPhotos(photosData ?? []);
      setLoading(false);
    }
    load();
  }, [albumId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">{tc("loading")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/gallery"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tc("back")}
      </Link>

      <h1 className="text-3xl font-bold mb-6">{album?.title}</h1>

      {photos.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">{tc("noData")}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className="aspect-square rounded-lg overflow-hidden cursor-pointer group relative"
              onClick={() => setSelectedIndex(idx)}
            >
              <Image
                src={photo.image_url}
                alt={photo.caption ?? ""}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={() => setSelectedIndex(null)}
          >
            <X className="h-6 w-6" />
          </Button>

          {selectedIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 text-white hover:bg-white/10"
              onClick={() => setSelectedIndex(selectedIndex - 1)}
            >
              <ChevronLeftIcon className="h-8 w-8" />
            </Button>
          )}

          {selectedIndex < photos.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 text-white hover:bg-white/10"
              onClick={() => setSelectedIndex(selectedIndex + 1)}
            >
              <ChevronRightIcon className="h-8 w-8" />
            </Button>
          )}

          <Image
            src={photos[selectedIndex].image_url}
            alt={photos[selectedIndex].caption ?? ""}
            width={1600}
            height={1200}
            className="max-h-[85vh] max-w-[90vw] object-contain"
          />

          {photos[selectedIndex].caption && (
            <p className="absolute bottom-8 text-white text-sm">
              {photos[selectedIndex].caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
