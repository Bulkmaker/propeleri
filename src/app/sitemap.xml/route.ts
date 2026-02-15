import { createClient } from "@/lib/supabase/server";

const BASE_URL = "https://propeleri.rs";

interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

function entry(
  path: string,
  lastModified?: string | null,
  priority = 0.7
): SitemapEntry {
  return {
    url: `${BASE_URL}${path}`,
    lastmod: lastModified
      ? new Date(lastModified).toISOString()
      : new Date().toISOString(),
    changefreq: "weekly",
    priority,
  };
}

function toXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (e) => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export async function GET() {
  const supabase = await createClient();

  const staticEntries: SitemapEntry[] = [
    entry("", null, 1.0),
    entry("/games", null, 0.9),
    entry("/roster", null, 0.9),
    entry("/training", null, 0.7),
    entry("/gallery", null, 0.7),
    entry("/events", null, 0.7),
    entry("/stats", null, 0.8),
    entry("/schedule", null, 0.8),
    entry("/changelog", null, 0.3),
  ];

  const [gamesRes, playersRes, sessionsRes, eventsRes, albumsRes, tournamentsRes] =
    await Promise.all([
      supabase
        .from("games")
        .select("slug, updated_at")
        .order("game_date", { ascending: false }),
      supabase
        .from("profiles")
        .select("slug, updated_at")
        .eq("is_active", true)
        .eq("is_approved", true),
      supabase
        .from("training_sessions")
        .select("slug, created_at")
        .order("session_date", { ascending: false }),
      supabase
        .from("events")
        .select("slug, updated_at")
        .eq("is_published", true),
      supabase.from("gallery_albums").select("slug, created_at"),
      supabase.from("tournaments").select("slug, created_at"),
    ]);

  const entries: SitemapEntry[] = [
    ...staticEntries,
    ...(gamesRes.data ?? []).filter((g) => g.slug).map((g) => entry(`/games/${g.slug}`, g.updated_at, 0.7)),
    ...(playersRes.data ?? []).filter((p) => p.slug).map((p) => entry(`/roster/${p.slug}`, p.updated_at, 0.6)),
    ...(sessionsRes.data ?? []).filter((s) => s.slug).map((s) => entry(`/training/${s.slug}`, s.created_at, 0.5)),
    ...(eventsRes.data ?? []).filter((e) => e.slug).map((e) => entry(`/events/${e.slug}`, e.updated_at, 0.6)),
    ...(albumsRes.data ?? []).filter((a) => a.slug).map((a) => entry(`/gallery/${a.slug}`, a.created_at, 0.5)),
    ...(tournamentsRes.data ?? []).filter((t) => t.slug).map((t) => entry(`/tournaments/${t.slug}`, t.created_at, 0.7)),
  ];

  return new Response(toXml(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
