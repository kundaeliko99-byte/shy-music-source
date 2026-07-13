-- Add exact release scheduling. Artists can upload now and choose when a
-- track/album becomes visible to listeners.

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS release_at timestamptz;

ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS release_at timestamptz;

UPDATE public.tracks
SET release_at = release_date::timestamptz
WHERE release_at IS NULL;

UPDATE public.albums
SET release_at = release_date::timestamptz
WHERE release_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tracks_release_at
  ON public.tracks (release_at DESC);

CREATE INDEX IF NOT EXISTS idx_albums_release_at
  ON public.albums (release_at DESC);

DROP POLICY IF EXISTS "tracks_select_all" ON public.tracks;
DROP POLICY IF EXISTS tracks_select_all ON public.tracks;
CREATE POLICY tracks_select_public_or_owner
  ON public.tracks FOR SELECT
  USING (
    COALESCE(release_at, release_date::timestamptz) <= now()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = tracks.artist_id
        AND a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "albums_select_all" ON public.albums;
DROP POLICY IF EXISTS albums_select_all ON public.albums;
CREATE POLICY albums_select_public_or_owner
  ON public.albums FOR SELECT
  USING (
    COALESCE(release_at, release_date::timestamptz) <= now()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = albums.artist_id
        AND a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

NOTIFY pgrst, 'reload schema';
