-- Enable RLS and add policies for all tables that were missing them.
-- Pattern: everyone can read, only admins (via service_role or app_role = 'admin') can mutate.

-- ============================================================
-- profiles
-- ============================================================
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: anyone can read"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles: users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: service_role can do anything"
  ON public.profiles
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- seasons
-- ============================================================
ALTER TABLE IF EXISTS public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons: anyone can read"
  ON public.seasons FOR SELECT
  USING (true);

CREATE POLICY "seasons: service_role can do anything"
  ON public.seasons
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- games
-- ============================================================
ALTER TABLE IF EXISTS public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "games: anyone can read"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "games: service_role can do anything"
  ON public.games
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- game_lineups
-- ============================================================
ALTER TABLE IF EXISTS public.game_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_lineups: anyone can read"
  ON public.game_lineups FOR SELECT
  USING (true);

CREATE POLICY "game_lineups: authenticated can insert"
  ON public.game_lineups FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "game_lineups: authenticated can update"
  ON public.game_lineups FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "game_lineups: authenticated can delete"
  ON public.game_lineups FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "game_lineups: service_role can do anything"
  ON public.game_lineups
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- game_stats
-- ============================================================
ALTER TABLE IF EXISTS public.game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_stats: anyone can read"
  ON public.game_stats FOR SELECT
  USING (true);

CREATE POLICY "game_stats: service_role can do anything"
  ON public.game_stats
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- training_sessions
-- ============================================================
ALTER TABLE IF EXISTS public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_sessions: anyone can read"
  ON public.training_sessions FOR SELECT
  USING (true);

CREATE POLICY "training_sessions: service_role can do anything"
  ON public.training_sessions
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- training_stats
-- ============================================================
ALTER TABLE IF EXISTS public.training_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_stats: anyone can read"
  ON public.training_stats FOR SELECT
  USING (true);

CREATE POLICY "training_stats: service_role can do anything"
  ON public.training_stats
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- events
-- ============================================================
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events: anyone can read"
  ON public.events FOR SELECT
  USING (true);

CREATE POLICY "events: service_role can do anything"
  ON public.events
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- teams
-- ============================================================
ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams: anyone can read"
  ON public.teams FOR SELECT
  USING (true);

CREATE POLICY "teams: service_role can do anything"
  ON public.teams
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- tournaments
-- ============================================================
ALTER TABLE IF EXISTS public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournaments: anyone can read"
  ON public.tournaments FOR SELECT
  USING (true);

CREATE POLICY "tournaments: service_role can do anything"
  ON public.tournaments
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- tournament_teams
-- ============================================================
ALTER TABLE IF EXISTS public.tournament_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_teams: anyone can read"
  ON public.tournament_teams FOR SELECT
  USING (true);

CREATE POLICY "tournament_teams: service_role can do anything"
  ON public.tournament_teams
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- tournament_groups
-- ============================================================
ALTER TABLE IF EXISTS public.tournament_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_groups: anyone can read"
  ON public.tournament_groups FOR SELECT
  USING (true);

CREATE POLICY "tournament_groups: service_role can do anything"
  ON public.tournament_groups
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- tournament_group_teams
-- ============================================================
ALTER TABLE IF EXISTS public.tournament_group_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_group_teams: anyone can read"
  ON public.tournament_group_teams FOR SELECT
  USING (true);

CREATE POLICY "tournament_group_teams: service_role can do anything"
  ON public.tournament_group_teams
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- tournament_matches
-- ============================================================
ALTER TABLE IF EXISTS public.tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_matches: anyone can read"
  ON public.tournament_matches FOR SELECT
  USING (true);

CREATE POLICY "tournament_matches: service_role can do anything"
  ON public.tournament_matches
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- gallery_albums
-- ============================================================
ALTER TABLE IF EXISTS public.gallery_albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gallery_albums: anyone can read"
  ON public.gallery_albums FOR SELECT
  USING (true);

CREATE POLICY "gallery_albums: service_role can do anything"
  ON public.gallery_albums
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- gallery_photos
-- ============================================================
ALTER TABLE IF EXISTS public.gallery_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gallery_photos: anyone can read"
  ON public.gallery_photos FOR SELECT
  USING (true);

CREATE POLICY "gallery_photos: service_role can do anything"
  ON public.gallery_photos
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
