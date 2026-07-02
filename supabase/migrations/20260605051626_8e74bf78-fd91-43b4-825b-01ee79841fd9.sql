-- 1) Restrict user self-insert on user_roles to 'listener' only
DROP POLICY IF EXISTS user_roles_insert_own_listener ON public.user_roles;
CREATE POLICY user_roles_insert_own_listener
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'listener'::app_role);

-- 2) UPDATE policy on playlist_tracks (so owners can reorder)
DROP POLICY IF EXISTS playlist_tracks_update_own ON public.playlist_tracks;
CREATE POLICY playlist_tracks_update_own
  ON public.playlist_tracks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_tracks.playlist_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_tracks.playlist_id AND p.user_id = auth.uid()));

-- 3) DELETE policy on storage.objects for the avatars bucket, scoped to the file owner
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
