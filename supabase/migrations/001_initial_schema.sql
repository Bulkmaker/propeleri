-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE player_position AS ENUM ('forward', 'defense', 'goalie');
CREATE TYPE player_role AS ENUM ('player', 'captain', 'assistant_captain');
CREATE TYPE user_app_role AS ENUM ('admin', 'player');
CREATE TYPE event_type AS ENUM ('game', 'training', 'tournament', 'social');
CREATE TYPE lineup_designation AS ENUM ('captain', 'assistant_captain', 'player');
CREATE TYPE game_result AS ENUM ('win', 'loss', 'draw', 'pending');

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  jersey_number INTEGER,
  position player_position NOT NULL DEFAULT 'forward',
  team_role player_role NOT NULL DEFAULT 'player',
  app_role user_app_role NOT NULL DEFAULT 'player',
  avatar_url TEXT,
  bio TEXT,
  date_of_birth DATE,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEASONS
-- ============================================================

CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TOURNAMENTS
-- ============================================================

CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id),
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- GAMES
-- ============================================================

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id),
  tournament_id UUID REFERENCES tournaments(id),
  opponent TEXT NOT NULL,
  location TEXT,
  game_date TIMESTAMPTZ NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  is_home BOOLEAN NOT NULL DEFAULT true,
  result game_result NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- GAME LINEUP
-- ============================================================

CREATE TABLE game_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id),
  designation lineup_designation NOT NULL DEFAULT 'player',
  position_played player_position NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- ============================================================
-- GAME STATS
-- ============================================================

CREATE TABLE game_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id),
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  penalty_minutes INTEGER NOT NULL DEFAULT 0,
  plus_minus INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- ============================================================
-- TRAINING SESSIONS
-- ============================================================

CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id),
  title TEXT,
  session_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER training_sessions_updated_at
  BEFORE UPDATE ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRAINING STATS
-- ============================================================

CREATE TABLE training_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES profiles(id),
  attended BOOLEAN NOT NULL DEFAULT true,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, player_id)
);

-- ============================================================
-- EVENTS
-- ============================================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_ru TEXT,
  title_en TEXT,
  description TEXT,
  description_ru TEXT,
  description_en TEXT,
  event_type event_type NOT NULL DEFAULT 'social',
  event_date TIMESTAMPTZ,
  location TEXT,
  cover_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- GALLERY
-- ============================================================

CREATE TABLE gallery_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_ru TEXT,
  title_en TEXT,
  description TEXT,
  cover_image_url TEXT,
  event_id UUID REFERENCES events(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES gallery_albums(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE VIEW player_game_totals AS
SELECT
  gs.player_id,
  p.first_name,
  p.last_name,
  p.jersey_number,
  p.position,
  p.avatar_url,
  p.team_role,
  COUNT(gs.id) AS games_played,
  COALESCE(SUM(gs.goals), 0) AS total_goals,
  COALESCE(SUM(gs.assists), 0) AS total_assists,
  COALESCE(SUM(gs.goals), 0) + COALESCE(SUM(gs.assists), 0) AS total_points,
  COALESCE(SUM(gs.penalty_minutes), 0) AS total_pim,
  COALESCE(SUM(gs.plus_minus), 0) AS total_plus_minus
FROM game_stats gs
JOIN profiles p ON gs.player_id = p.id
WHERE p.is_active = true
GROUP BY gs.player_id, p.first_name, p.last_name, p.jersey_number, p.position, p.avatar_url, p.team_role;

CREATE VIEW player_training_totals AS
SELECT
  ts.player_id,
  p.first_name,
  p.last_name,
  COUNT(ts.id) FILTER (WHERE ts.attended = true) AS sessions_attended,
  COALESCE(SUM(ts.goals), 0) AS training_goals,
  COALESCE(SUM(ts.assists), 0) AS training_assists
FROM training_stats ts
JOIN profiles p ON ts.player_id = p.id
WHERE p.is_active = true
GROUP BY ts.player_id, p.first_name, p.last_name;

CREATE VIEW player_season_stats AS
SELECT
  gs.player_id,
  g.season_id,
  s.name AS season_name,
  COUNT(gs.id) AS games_played,
  COALESCE(SUM(gs.goals), 0) AS goals,
  COALESCE(SUM(gs.assists), 0) AS assists,
  COALESCE(SUM(gs.goals), 0) + COALESCE(SUM(gs.assists), 0) AS points,
  COALESCE(SUM(gs.penalty_minutes), 0) AS pim,
  COALESCE(SUM(gs.plus_minus), 0) AS plus_minus
FROM game_stats gs
JOIN games g ON gs.game_id = g.id
JOIN seasons s ON g.season_id = s.id
GROUP BY gs.player_id, g.season_id, s.name;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND app_role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_team_leader()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (team_role IN ('captain', 'assistant_captain') OR app_role = 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  USING (is_admin());

-- SEASONS
CREATE POLICY "seasons_select" ON seasons FOR SELECT USING (true);
CREATE POLICY "seasons_write" ON seasons FOR ALL USING (is_admin());

-- TOURNAMENTS
CREATE POLICY "tournaments_select" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_write" ON tournaments FOR ALL USING (is_admin());

-- GAMES
CREATE POLICY "games_select" ON games FOR SELECT USING (true);
CREATE POLICY "games_insert" ON games FOR INSERT WITH CHECK (is_team_leader());
CREATE POLICY "games_update" ON games FOR UPDATE USING (is_team_leader());
CREATE POLICY "games_delete" ON games FOR DELETE USING (is_admin());

-- GAME LINEUPS
CREATE POLICY "lineups_select" ON game_lineups FOR SELECT USING (true);
CREATE POLICY "lineups_insert" ON game_lineups FOR INSERT WITH CHECK (is_team_leader());
CREATE POLICY "lineups_update" ON game_lineups FOR UPDATE USING (is_team_leader());
CREATE POLICY "lineups_delete" ON game_lineups FOR DELETE USING (is_team_leader());

-- GAME STATS
CREATE POLICY "game_stats_select" ON game_stats FOR SELECT USING (true);
CREATE POLICY "game_stats_insert" ON game_stats FOR INSERT WITH CHECK (is_team_leader());
CREATE POLICY "game_stats_update" ON game_stats FOR UPDATE USING (is_team_leader());
CREATE POLICY "game_stats_delete" ON game_stats FOR DELETE USING (is_admin());

-- TRAINING
CREATE POLICY "training_select" ON training_sessions FOR SELECT USING (true);
CREATE POLICY "training_insert" ON training_sessions FOR INSERT WITH CHECK (is_team_leader());
CREATE POLICY "training_update" ON training_sessions FOR UPDATE USING (is_team_leader());
CREATE POLICY "training_delete" ON training_sessions FOR DELETE USING (is_admin());

CREATE POLICY "training_stats_select" ON training_stats FOR SELECT USING (true);
CREATE POLICY "training_stats_insert" ON training_stats FOR INSERT WITH CHECK (is_team_leader());
CREATE POLICY "training_stats_update" ON training_stats FOR UPDATE USING (is_team_leader());
CREATE POLICY "training_stats_delete" ON training_stats FOR DELETE USING (is_admin());

-- EVENTS
CREATE POLICY "events_select" ON events FOR SELECT
  USING (is_published = true OR is_team_leader());
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (is_team_leader());
CREATE POLICY "events_update" ON events FOR UPDATE USING (is_team_leader());
CREATE POLICY "events_delete" ON events FOR DELETE USING (is_admin());

-- GALLERY
CREATE POLICY "albums_select" ON gallery_albums FOR SELECT USING (true);
CREATE POLICY "albums_insert" ON gallery_albums FOR INSERT WITH CHECK (is_team_leader());
CREATE POLICY "albums_update" ON gallery_albums FOR UPDATE USING (is_team_leader());
CREATE POLICY "albums_delete" ON gallery_albums FOR DELETE USING (is_admin());

CREATE POLICY "photos_select" ON gallery_photos FOR SELECT USING (true);
CREATE POLICY "photos_insert" ON gallery_photos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "photos_update" ON gallery_photos FOR UPDATE
  USING (uploaded_by = auth.uid() OR is_admin());
CREATE POLICY "photos_delete" ON gallery_photos FOR DELETE
  USING (uploaded_by = auth.uid() OR is_admin());

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('events', 'events', true);

-- Storage policies
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "gallery_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');
CREATE POLICY "gallery_auth_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'gallery' AND auth.uid() IS NOT NULL);
CREATE POLICY "gallery_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'gallery' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

CREATE POLICY "events_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'events');
CREATE POLICY "events_leader_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'events' AND public.is_team_leader());
CREATE POLICY "events_leader_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'events' AND public.is_team_leader());
