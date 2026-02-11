-- Training sessions: structured match info (score, goalies, goal events)

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS match_data jsonb;

CREATE INDEX IF NOT EXISTS idx_training_sessions_match_data
  ON public.training_sessions
  USING gin (match_data);
