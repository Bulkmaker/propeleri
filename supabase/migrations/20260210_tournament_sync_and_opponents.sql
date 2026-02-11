-- Tournament/game sync + opponents catalog

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_opponent_name(input_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(trim(coalesce(input_name, ''))), '\\s+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION public.opponents_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_name := public.normalize_opponent_name(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- Opponents catalog
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opponents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text NOT NULL,
  city text,
  country text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opponents_normalized_name_key'
  ) THEN
    ALTER TABLE public.opponents
      ADD CONSTRAINT opponents_normalized_name_key UNIQUE (normalized_name);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_opponents_before_write ON public.opponents;
CREATE TRIGGER trg_opponents_before_write
  BEFORE INSERT OR UPDATE ON public.opponents
  FOR EACH ROW
  EXECUTE FUNCTION public.opponents_before_write();

CREATE INDEX IF NOT EXISTS idx_opponents_normalized_name
  ON public.opponents (normalized_name);

-- ------------------------------------------------------------
-- Schema extensions
-- ------------------------------------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS opponent_id uuid;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS opponent_id uuid;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS auto_generated_from_tournament boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'teams_opponent_id_fkey'
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_opponent_id_fkey
      FOREIGN KEY (opponent_id)
      REFERENCES public.opponents(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'games_opponent_id_fkey'
  ) THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_opponent_id_fkey
      FOREIGN KEY (opponent_id)
      REFERENCES public.opponents(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teams_opponent_id
  ON public.teams (opponent_id);

CREATE INDEX IF NOT EXISTS idx_games_opponent_date
  ON public.games (opponent_id, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_games_tournament_date
  ON public.games (tournament_id, game_date DESC);

-- ------------------------------------------------------------
-- RLS for opponents
-- ------------------------------------------------------------
ALTER TABLE public.opponents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opponents'
      AND policyname = 'opponents_select'
  ) THEN
    CREATE POLICY opponents_select ON public.opponents
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opponents'
      AND policyname = 'opponents_insert'
  ) THEN
    CREATE POLICY opponents_insert ON public.opponents
      FOR INSERT
      WITH CHECK (public.is_team_leader());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opponents'
      AND policyname = 'opponents_update'
  ) THEN
    CREATE POLICY opponents_update ON public.opponents
      FOR UPDATE
      USING (public.is_team_leader())
      WITH CHECK (public.is_team_leader());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opponents'
      AND policyname = 'opponents_delete'
  ) THEN
    CREATE POLICY opponents_delete ON public.opponents
      FOR DELETE
      USING (public.is_team_leader());
  END IF;
END $$;

-- ------------------------------------------------------------
-- Backfill opponents from games + teams
-- ------------------------------------------------------------
INSERT INTO public.opponents (name, normalized_name, city, country)
SELECT src.name, public.normalize_opponent_name(src.name), src.city, src.country
FROM (
  SELECT DISTINCT trim(g.opponent) AS name, NULL::text AS city, NULL::text AS country
  FROM public.games g
  WHERE g.opponent IS NOT NULL
    AND trim(g.opponent) <> ''

  UNION

  SELECT DISTINCT trim(t.name) AS name, t.city, t.country
  FROM public.teams t
  WHERE coalesce(t.is_propeleri, false) = false
    AND t.name IS NOT NULL
    AND trim(t.name) <> ''
) src
WHERE src.name IS NOT NULL
  AND src.name <> ''
ON CONFLICT (normalized_name) DO NOTHING;

UPDATE public.teams t
SET opponent_id = o.id
FROM public.opponents o
WHERE coalesce(t.is_propeleri, false) = false
  AND t.name IS NOT NULL
  AND public.normalize_opponent_name(t.name) = o.normalized_name
  AND (t.opponent_id IS NULL OR t.opponent_id <> o.id);

UPDATE public.games g
SET opponent_id = o.id
FROM public.opponents o
WHERE g.opponent IS NOT NULL
  AND trim(g.opponent) <> ''
  AND public.normalize_opponent_name(g.opponent) = o.normalized_name
  AND (g.opponent_id IS NULL OR g.opponent_id <> o.id);

UPDATE public.games g
SET opponent = o.name
FROM public.opponents o
WHERE g.opponent_id = o.id
  AND g.opponent IS DISTINCT FROM o.name;

-- ------------------------------------------------------------
-- Tournament -> games sync
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_tournament_match_to_game()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tournament_row RECORD;
  team_a RECORD;
  team_b RECORD;
  prop_team RECORD;
  opp_team RECORD;
  effective_date timestamptz;
  prop_score integer;
  opp_score integer;
  computed_result game_result;
  generated_game_id uuid;
BEGIN
  SELECT id, season_id, start_date
  INTO tournament_row
  FROM public.tournaments
  WHERE id = NEW.tournament_id;

  IF tournament_row.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, name, city, country, is_propeleri, opponent_id
  INTO team_a
  FROM public.teams
  WHERE id = NEW.team_a_id;

  SELECT id, name, city, country, is_propeleri, opponent_id
  INTO team_b
  FROM public.teams
  WHERE id = NEW.team_b_id;

  IF team_a.id IS NULL OR team_b.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF coalesce(team_a.is_propeleri, false) THEN
    prop_team := team_a;
    opp_team := team_b;
  ELSIF coalesce(team_b.is_propeleri, false) THEN
    prop_team := team_b;
    opp_team := team_a;
  ELSE
    IF NEW.game_id IS NOT NULL THEN
      DELETE FROM public.games
      WHERE id = NEW.game_id
        AND auto_generated_from_tournament = true;
    END IF;
    NEW.game_id := NULL;
    RETURN NEW;
  END IF;

  IF opp_team.opponent_id IS NULL THEN
    INSERT INTO public.opponents (name, normalized_name, city, country)
    VALUES (
      opp_team.name,
      public.normalize_opponent_name(opp_team.name),
      opp_team.city,
      opp_team.country
    )
    ON CONFLICT (normalized_name)
    DO UPDATE SET
      name = EXCLUDED.name,
      city = COALESCE(public.opponents.city, EXCLUDED.city),
      country = COALESCE(public.opponents.country, EXCLUDED.country)
    RETURNING id INTO opp_team.opponent_id;

    UPDATE public.teams
    SET opponent_id = opp_team.opponent_id
    WHERE id = opp_team.id;
  END IF;

  effective_date := coalesce(NEW.match_date, tournament_row.start_date::timestamptz);

  IF coalesce(team_a.is_propeleri, false) THEN
    prop_score := coalesce(NEW.score_a, 0);
    opp_score := coalesce(NEW.score_b, 0);
  ELSE
    prop_score := coalesce(NEW.score_b, 0);
    opp_score := coalesce(NEW.score_a, 0);
  END IF;

  IF coalesce(NEW.is_completed, false) = false THEN
    computed_result := 'pending';
  ELSIF prop_score > opp_score THEN
    computed_result := 'win';
  ELSIF prop_score < opp_score THEN
    computed_result := 'loss';
  ELSE
    computed_result := 'draw';
  END IF;

  generated_game_id := coalesce(NEW.game_id, gen_random_uuid());

  INSERT INTO public.games (
    id,
    season_id,
    tournament_id,
    opponent_id,
    opponent,
    game_date,
    is_home,
    home_score,
    away_score,
    result,
    auto_generated_from_tournament
  )
  VALUES (
    generated_game_id,
    tournament_row.season_id,
    NEW.tournament_id,
    opp_team.opponent_id,
    opp_team.name,
    effective_date,
    coalesce(team_a.is_propeleri, false),
    coalesce(NEW.score_a, 0),
    coalesce(NEW.score_b, 0),
    computed_result,
    true
  )
  ON CONFLICT (id)
  DO UPDATE SET
    season_id = EXCLUDED.season_id,
    tournament_id = EXCLUDED.tournament_id,
    opponent_id = EXCLUDED.opponent_id,
    opponent = EXCLUDED.opponent,
    game_date = EXCLUDED.game_date,
    is_home = EXCLUDED.is_home,
    home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score,
    result = EXCLUDED.result,
    auto_generated_from_tournament = true,
    updated_at = now();

  NEW.game_id := generated_game_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_auto_game_for_tournament_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.game_id IS NOT NULL THEN
    DELETE FROM public.games
    WHERE id = OLD.game_id
      AND auto_generated_from_tournament = true;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tournament_match_to_game ON public.tournament_matches;
CREATE TRIGGER trg_sync_tournament_match_to_game
  BEFORE INSERT OR UPDATE OF
    team_a_id,
    team_b_id,
    tournament_id,
    score_a,
    score_b,
    is_completed,
    match_date
  ON public.tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tournament_match_to_game();

DROP TRIGGER IF EXISTS trg_delete_auto_game_for_tournament_match ON public.tournament_matches;
CREATE TRIGGER trg_delete_auto_game_for_tournament_match
  AFTER DELETE ON public.tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_auto_game_for_tournament_match();
