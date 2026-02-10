type ImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

export default function supabaseImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  if (src.startsWith("http")) {
    // Supabase Storage URL — use render endpoint for transformations
    const url = new URL(src);
    if (url.pathname.includes("/storage/v1/object/public/")) {
      const renderPath = url.pathname.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/"
      );
      return `${url.origin}${renderPath}?width=${width}&quality=${quality || 75}`;
    }
    return src;
  }
  return src;
}
