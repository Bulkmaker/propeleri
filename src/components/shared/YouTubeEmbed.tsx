import {
  extractYouTubeStartSeconds,
  extractYouTubeVideoId,
  getYouTubeEmbedUrl,
} from "@/lib/utils/youtube";
import { cn } from "@/lib/utils";

interface YouTubeEmbedProps {
  url: string;
  title?: string;
  className?: string;
  rounded?: boolean;
  autoplay?: boolean;
}

export function YouTubeEmbed({
  url,
  title = "YouTube video",
  className,
  rounded = true,
  autoplay = false,
}: YouTubeEmbedProps) {
  const videoId = extractYouTubeVideoId(url);
  const startSeconds = extractYouTubeStartSeconds(url);
  if (!videoId) return null;
  const radiusClass = rounded ? "rounded-lg" : "rounded-none";

  return (
    <div
      className={cn("relative w-full overflow-hidden", radiusClass, className)}
      style={{ paddingBottom: "56.25%" }}
    >
      <iframe
        src={getYouTubeEmbedUrl(videoId, startSeconds, autoplay)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className={cn("absolute inset-0 h-full w-full", radiusClass)}
        loading="lazy"
      />
    </div>
  );
}
