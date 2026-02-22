-- Harden tournament -> games score sync: never write NULL/empty slug.

ALTER TABLE public.games
  ALTER COLUMN slug SET DEFAULT ('game-' || left(gen_random_uuid()::text, 8));

UPDATE public.games
SET slug = 'game-' || left(id::text, 8)
WHERE slug IS NULL OR btrim(slug) = '';

ALTER TABLE public.games
  ALTER COLUMN slug SET NOT NULL;

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
  opp_team RECORD;
  effective_date timestamptz;
  prop_score integer;
  opp_score integer;
  computed_result game_result;
  generated_game_id uuid;
  opponent_slug_part text;
  generated_slug text;
BEGIN
  SELECT id, season_id, start_date, location
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
    opp_team := team_b;
  ELSIF coalesce(team_b.is_propeleri, false) THEN
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

  opponent_slug_part := regexp_replace(
    lower(coalesce(opp_team.name, 'opponent')),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  opponent_slug_part := trim(both '-' from opponent_slug_part);
  IF opponent_slug_part = '' THEN
    opponent_slug_part := 'opponent';
  END IF;

  generated_slug := format(
    '%s-vs-%s-%s-%s',
    to_char(coalesce(effective_date, now()) at time zone 'UTC', 'YYYY-MM-DD'),
    opponent_slug_part,
    CASE WHEN coalesce(team_a.is_propeleri, false) THEN 'home' ELSE 'away' END,
    left(generated_game_id::text, 8)
  );

  IF generated_slug IS NULL OR btrim(generated_slug) = '' THEN
    generated_slug := 'game-' || left(generated_game_id::text, 8);
  END IF;

  INSERT INTO public.games (
    id,
    season_id,
    tournament_id,
    opponent_id,
    opponent,
    slug,
    location,
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
    generated_slug,
    tournament_row.location,
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
    slug = CASE
      WHEN public.games.slug IS NULL OR btrim(public.games.slug) = '' THEN EXCLUDED.slug
      ELSE public.games.slug
    END,
    location = EXCLUDED.location,
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
