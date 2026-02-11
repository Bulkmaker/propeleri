-- Mark players that train as guests

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_guest
  ON public.profiles (is_guest, is_active, is_approved);
