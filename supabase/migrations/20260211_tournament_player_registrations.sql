-- Tournament player registrations (declared roster)

CREATE TABLE IF NOT EXISTS public.tournament_player_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tournament_player_registrations_tournament_player_key'
  ) THEN
    ALTER TABLE public.tournament_player_registrations
      ADD CONSTRAINT tournament_player_registrations_tournament_player_key
      UNIQUE (tournament_id, player_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tournament_player_registrations_tournament
  ON public.tournament_player_registrations (tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_player_registrations_player
  ON public.tournament_player_registrations (player_id);

ALTER TABLE public.tournament_player_registrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tournament_player_registrations'
      AND policyname = 'tournament_player_registrations_select'
  ) THEN
    CREATE POLICY tournament_player_registrations_select
      ON public.tournament_player_registrations
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tournament_player_registrations'
      AND policyname = 'tournament_player_registrations_insert'
  ) THEN
    CREATE POLICY tournament_player_registrations_insert
      ON public.tournament_player_registrations
      FOR INSERT
      WITH CHECK (public.is_team_leader());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tournament_player_registrations'
      AND policyname = 'tournament_player_registrations_delete'
  ) THEN
    CREATE POLICY tournament_player_registrations_delete
      ON public.tournament_player_registrations
      FOR DELETE
      USING (public.is_team_leader());
  END IF;
END $$;
