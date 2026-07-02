-- Update first artist: 18k fans
UPDATE public.artists SET monthly_listeners = 18000 WHERE id = 'fffc185c-fc73-4230-b2aa-083867b3c023';

-- Storage policies so artists can upload to avatars + banners buckets (path prefixed by user id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_user_insert') THEN
    CREATE POLICY "avatars_user_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_user_update') THEN
    CREATE POLICY "avatars_user_update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_user_delete') THEN
    CREATE POLICY "avatars_user_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='banners_user_insert') THEN
    CREATE POLICY "banners_user_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='banners_user_update') THEN
    CREATE POLICY "banners_user_update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='banners_user_delete') THEN
    CREATE POLICY "banners_user_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_public_read') THEN
    CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='banners_public_read') THEN
    CREATE POLICY "banners_public_read" ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'banners');
  END IF;
END$$;