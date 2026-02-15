import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Camera, ImageIcon } from "lucide-react";
import type { GalleryAlbum } from "@/types/database";

function getLocalizedField(
  item: Pick<GalleryAlbum, "title" | "title_ru" | "title_en">,
  locale: string
): string {
  if (locale === "ru" && item.title_ru) return item.title_ru;
  if (locale === "en" && item.title_en) return item.title_en;
  return item.title;
}

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("gallery.title"),
    description: t("gallery.description"),
    alternates: {
      canonical: locale === "sr" ? "/gallery" : `/${locale}/gallery`,
      languages: { sr: "/gallery", ru: "/ru/gallery", en: "/en/gallery" },
    },
    openGraph: { title: t("gallery.title"), description: t("gallery.description") },
  };
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("gallery");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  const { data: albums } = await supabase
    .from("gallery_albums")
    .select("*, photos:gallery_photos(count)")
    .order("created_at", { ascending: false });

  const allAlbums = (albums ?? []) as (GalleryAlbum & { photos: [{ count: number }] })[];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Camera className="h-5 w-5 text-purple-400" />
        </div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>

      {allAlbums.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Camera className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{tc("noData")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {allAlbums.map((album) => (
            <Link key={album.id} href={`/gallery/${album.slug}`}>
              <Card className="border-border/40 card-hover bg-card cursor-pointer overflow-hidden group">
                <div className="aspect-[4/3] bg-secondary relative overflow-hidden">
                  {album.cover_image_url ? (
                    <Image
                      src={album.cover_image_url}
                      alt={getLocalizedField(album, locale)}
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-white font-semibold text-sm">
                      {getLocalizedField(album, locale)}
                    </p>
                    <p className="text-white/70 text-xs">
                      {album.photos?.[0]?.count ?? 0} {t("photos").toLowerCase()}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
