-- Optional player nickname for display name.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text;

CREATE INDEX IF NOT EXISTS idx_profiles_nickname
  ON public.profiles (nickname)
  WHERE nickname IS NOT NULL;
