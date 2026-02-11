-- Training sessions: lifecycle status for planning/completion tracking

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'training_session_status'
  ) THEN
    CREATE TYPE public.training_session_status AS ENUM ('planned', 'completed', 'canceled');
  END IF;
END $$;

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS status public.training_session_status NOT NULL DEFAULT 'planned';

UPDATE public.training_sessions
SET status = 'planned'
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_training_sessions_status_date
  ON public.training_sessions (status, session_date DESC);
