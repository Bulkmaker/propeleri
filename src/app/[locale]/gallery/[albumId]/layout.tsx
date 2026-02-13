import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; albumId: string }>;
}): Promise<Metadata> {
  const { locale, albumId } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const supabase = await createClient();
  const { data: album } = await supabase
    .from("gallery_albums")
    .select("title, title_ru, title_en, cover_image_url")
    .eq("id", albumId)
    .single();

  if (!album) return { title: "Album Not Found" };

  const albumTitle =
    locale === "ru" && album.title_ru
      ? album.title_ru
      : locale === "en" && album.title_en
        ? album.title_en
        : album.title;

  const title = t("albumDetail.title", { name: albumTitle });
  const description = t("albumDetail.description", { name: albumTitle });
  const path = `/gallery/${albumId}`;

  return {
    title,
    description,
    alternates: {
      canonical: locale === "sr" ? path : `/${locale}${path}`,
      languages: { sr: path, ru: `/ru${path}`, en: `/en${path}` },
    },
    openGraph: {
      title,
      description,
      ...(album.cover_image_url
        ? { images: [{ url: album.cover_image_url }] }
        : {}),
    },
  };
}

export default function AlbumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
