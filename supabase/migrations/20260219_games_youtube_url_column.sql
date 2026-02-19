-- Ensure legacy environments have the games.youtube_url column used by match video fields.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS youtube_url text;
