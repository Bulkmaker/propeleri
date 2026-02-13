import { extractYouTubeVideoId, getYouTubeEmbedUrl } from "@/lib/utils/youtube";

interface YouTubeEmbedProps {
  url: string;
  title?: string;
}

export function YouTubeEmbed({ url, title = "YouTube video" }: YouTubeEmbedProps) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
      <iframe
        src={getYouTubeEmbedUrl(videoId)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full rounded-lg"
        loading="lazy"
      />
    </div>
  );
}
