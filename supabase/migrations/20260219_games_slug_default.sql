-- Safety net: if any legacy trigger/path inserts into games without slug,
-- DB generates a unique fallback instead of failing NOT NULL constraint.
ALTER TABLE public.games
  ALTER COLUMN slug SET DEFAULT ('game-' || left(gen_random_uuid()::text, 8));
