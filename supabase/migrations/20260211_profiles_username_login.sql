-- Username-based login support for profiles.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_username_format'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_format
      CHECK (
        username IS NULL
        OR username ~ '^[a-z0-9._-]{3,32}$'
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

UPDATE public.profiles
SET username = lower(split_part(email, '@', 1))
WHERE username IS NULL
  AND email LIKE '%@player-login.local';
