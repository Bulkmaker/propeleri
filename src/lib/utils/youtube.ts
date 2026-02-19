/**
 * Extract a YouTube video ID from various URL formats.
 * Supports: youtube.com/watch?v=, youtu.be/, /embed/, /shorts/
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  const shortMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/
  );
  if (shortMatch) return shortMatch[1];

  const longMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?.*v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/
  );
  if (longMatch) return longMatch[1];

  return null;
}

function parseYouTubeTimestamp(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const unitMatch = trimmed.match(
    /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/
  );
  if (!unitMatch) return null;

  const hours = Number(unitMatch[1] ?? 0);
  const minutes = Number(unitMatch[2] ?? 0);
  const seconds = Number(unitMatch[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/** Extract start time (seconds) from YouTube URL params/hash, if present. */
export function extractYouTubeStartSeconds(url: string): number | null {
  if (!url || typeof url !== "string") return null;

  try {
    const parsedUrl = new URL(url);
    const fromParams =
      parseYouTubeTimestamp(parsedUrl.searchParams.get("t") ?? "") ??
      parseYouTubeTimestamp(parsedUrl.searchParams.get("start") ?? "");
    if (fromParams != null) return fromParams;

    const hash = parsedUrl.hash.startsWith("#")
      ? parsedUrl.hash.slice(1)
      : parsedUrl.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const fromHash =
        parseYouTubeTimestamp(hashParams.get("t") ?? "") ??
        parseYouTubeTimestamp(hashParams.get("start") ?? "");
      if (fromHash != null) return fromHash;
    }
  } catch {
    return null;
  }

  return null;
}

/** Privacy-enhanced embed URL (youtube-nocookie.com). */
export function getYouTubeEmbedUrl(videoId: string, startSeconds?: number | null): string {
  const base = `https://www.youtube-nocookie.com/embed/${videoId}`;
  if (!startSeconds || startSeconds <= 0) return base;
  return `${base}?start=${Math.floor(startSeconds)}`;
}

/** Check if a string is a valid YouTube URL. */
export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

/**
 * Parse "m:ss" / "mm:ss" goal clock to seconds.
 * Returns null for invalid values.
 */
export function goalClockToSeconds(value: string): number | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\./g, ":");
  if (!/^\d{1,2}:\d{2}$/.test(normalized)) return null;

  const [minutesRaw, secondsRaw] = normalized.split(":");
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || seconds >= 60) {
    return null;
  }
  return minutes * 60 + seconds;
}

/**
 * Build YouTube watch link with timestamp from goal clock.
 * If parsing fails or URL is invalid, returns the original URL.
 */
export function withYouTubeTimestamp(url: string, goalClock: string): string {
  if (!isValidYouTubeUrl(url)) return url;
  const seconds = goalClockToSeconds(goalClock);
  if (seconds == null) return url;

  try {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set("t", `${seconds}s`);
    return parsedUrl.toString();
  } catch {
    return url;
  }
}
