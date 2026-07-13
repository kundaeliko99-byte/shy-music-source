-- Keep browser audio uploads aligned with the app's artist access check.
-- The upload page allows users who own an artist profile; storage should match that.

DROP POLICY IF EXISTS "audio_artist_insert" ON storage.objects;
DROP POLICY IF EXISTS audio_artist_insert ON storage.objects;

CREATE POLICY audio_artist_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (
      public.has_role(auth.uid(), 'artist')
      OR EXISTS (
        SELECT 1
        FROM public.artists a
        WHERE a.user_id = auth.uid()
      )
    )
  );
