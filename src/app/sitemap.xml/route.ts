import { createClient } from "@/lib/supabase/server";

const BASE_URL = "https://propeleri.rs";

interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: string;
  priority: number;
  langs: { sr: string; ru: string; en: string };
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
    langs: {
      sr: `${BASE_URL}${path}`,
      ru: `${BASE_URL}/ru${path}`,
      en: `${BASE_URL}/en${path}`,
    },
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
    <xhtml:link rel="alternate" hreflang="sr" href="${e.langs.sr}"/>
    <xhtml:link rel="alternate" hreflang="ru" href="${e.langs.ru}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${e.langs.en}"/>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
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
        .select("id, updated_at")
        .order("game_date", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, updated_at")
        .eq("is_active", true)
        .eq("is_approved", true),
      supabase
        .from("training_sessions")
        .select("id, created_at")
        .order("session_date", { ascending: false }),
      supabase
        .from("events")
        .select("id, updated_at")
        .eq("is_published", true),
      supabase.from("gallery_albums").select("id, created_at"),
      supabase.from("tournaments").select("id, created_at"),
    ]);

  const entries: SitemapEntry[] = [
    ...staticEntries,
    ...(gamesRes.data ?? []).map((g) => entry(`/games/${g.id}`, g.updated_at, 0.7)),
    ...(playersRes.data ?? []).map((p) => entry(`/roster/${p.id}`, p.updated_at, 0.6)),
    ...(sessionsRes.data ?? []).map((s) => entry(`/training/${s.id}`, s.created_at, 0.5)),
    ...(eventsRes.data ?? []).map((e) => entry(`/events/${e.id}`, e.updated_at, 0.6)),
    ...(albumsRes.data ?? []).map((a) => entry(`/gallery/${a.id}`, a.created_at, 0.5)),
    ...(tournamentsRes.data ?? []).map((t) => entry(`/tournaments/${t.id}`, t.created_at, 0.7)),
  ];

  return new Response(toXml(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
