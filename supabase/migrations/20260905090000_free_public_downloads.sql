-- Free public downloads.
-- Publicly released tracks can be downloaded by visitors and signed-in users.
-- Private/scheduled tracks still cannot be claimed through this RPC.

ALTER TABLE public.downloads
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS session_id text;

CREATE INDEX IF NOT EXISTS idx_downloads_track_created
  ON public.downloads (track_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_downloads_session_created
  ON public.downloads (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

DROP POLICY IF EXISTS downloads_insert_own ON public.downloads;
DROP POLICY IF EXISTS downloads_insert_public_claims ON public.downloads;

CREATE POLICY downloads_insert_own
  ON public.downloads FOR INSERT TO authenticated
  WITH CHECK (
    track_id IS NOT NULL AND auth.uid() = user_id
  );

DROP FUNCTION IF EXISTS public.claim_download(uuid);
DROP FUNCTION IF EXISTS public.claim_download(uuid, text);

CREATE OR REPLACE FUNCTION public.claim_download(
  p_track_id uuid,
  p_session_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.tracks t
    WHERE t.id = p_track_id
      AND COALESCE(t.release_at, t.release_date::timestamptz) <= now()
      AND coalesce(t.moderation_status, 'active') = 'active'
      AND length(trim(coalesce(t.audio_url, ''))) > 0
  ) THEN
    RAISE EXCEPTION 'Track is not available for public download';
  END IF;

  INSERT INTO public.downloads (user_id, track_id, session_id)
  VALUES (v_user, p_track_id, nullif(left(coalesce(p_session_id, ''), 80), ''));

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_download(uuid, text) TO anon, authenticated;
