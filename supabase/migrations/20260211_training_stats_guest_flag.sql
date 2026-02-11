-- Mark per-session training participants as guest players

ALTER TABLE public.training_stats
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_training_stats_session_guest
  ON public.training_stats (session_id, is_guest);
