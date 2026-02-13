import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = "https://propeleri.rs";

function localizedEntry(
  path: string,
  lastModified?: string | null,
  priority = 0.7
): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE_URL}${path}`,
    lastModified: lastModified ? new Date(lastModified) : new Date(),
    changeFrequency: "weekly",
    priority,
    alternates: {
      languages: {
        sr: `${BASE_URL}${path}`,
        ru: `${BASE_URL}/ru${path}`,
        en: `${BASE_URL}/en${path}`,
      },
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // Static pages
  const staticEntries: MetadataRoute.Sitemap = [
    localizedEntry("", null, 1.0),
    localizedEntry("/games", null, 0.9),
    localizedEntry("/roster", null, 0.9),
    localizedEntry("/training", null, 0.7),
    localizedEntry("/gallery", null, 0.7),
    localizedEntry("/events", null, 0.7),
    localizedEntry("/stats", null, 0.8),
    localizedEntry("/schedule", null, 0.8),
    localizedEntry("/changelog", null, 0.3),
  ];

  // Dynamic: games
  const { data: games } = await supabase
    .from("games")
    .select("id, updated_at")
    .order("game_date", { ascending: false });
  const gameEntries = (games ?? []).map((g) =>
    localizedEntry(`/games/${g.id}`, g.updated_at, 0.7)
  );

  // Dynamic: players (active + approved)
  const { data: players } = await supabase
    .from("profiles")
    .select("id, updated_at")
    .eq("is_active", true)
    .eq("is_approved", true);
  const playerEntries = (players ?? []).map((p) =>
    localizedEntry(`/roster/${p.id}`, p.updated_at, 0.6)
  );

  // Dynamic: training sessions
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, created_at")
    .order("session_date", { ascending: false });
  const trainingEntries = (sessions ?? []).map((s) =>
    localizedEntry(`/training/${s.id}`, s.created_at, 0.5)
  );

  // Dynamic: published events
  const { data: events } = await supabase
    .from("events")
    .select("id, updated_at")
    .eq("is_published", true);
  const eventEntries = (events ?? []).map((e) =>
    localizedEntry(`/events/${e.id}`, e.updated_at, 0.6)
  );

  // Dynamic: gallery albums
  const { data: albums } = await supabase
    .from("gallery_albums")
    .select("id, created_at");
  const albumEntries = (albums ?? []).map((a) =>
    localizedEntry(`/gallery/${a.id}`, a.created_at, 0.5)
  );

  // Dynamic: tournaments
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, created_at");
  const tournamentEntries = (tournaments ?? []).map((t) =>
    localizedEntry(`/tournaments/${t.id}`, t.created_at, 0.7)
  );

  return [
    ...staticEntries,
    ...gameEntries,
    ...playerEntries,
    ...trainingEntries,
    ...eventEntries,
    ...albumEntries,
    ...tournamentEntries,
  ];
}
