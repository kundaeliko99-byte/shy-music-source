-- Security hardening for roles, streams, downloads, motivations, purchases, and media storage.

-- Users may only self-insert the default listener role. Artist/admin roles must
-- be created by trusted functions or admins.
DROP POLICY IF EXISTS "user_roles_insert_own_listener" ON public.user_roles;
DROP POLICY IF EXISTS user_roles_insert_own_listener ON public.user_roles;
CREATE POLICY user_roles_insert_own_listener
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'listener');

DROP POLICY IF EXISTS "artists_insert_own" ON public.artists;
DROP POLICY IF EXISTS artists_insert_own ON public.artists;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1) || '_' || substr(NEW.id::text,1,4))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'listener')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Controlled artist onboarding: this is the only self-service path that grants
-- artist status, and it creates the artist profile in the same trusted action.
CREATE OR REPLACE FUNCTION public.create_artist_profile(
  p_display_name text,
  p_bio text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_ai_tools public.ai_tool[] DEFAULT '{}',
  p_avatar_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL
)
RETURNS TABLE(id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_base_slug text;
  v_slug text;
  v_artist_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF length(trim(p_display_name)) < 1 OR length(trim(p_display_name)) > 50 THEN
    RAISE EXCEPTION 'Artist name must be 1-50 characters';
  END IF;
  IF p_bio IS NOT NULL AND length(p_bio) > 500 THEN
    RAISE EXCEPTION 'Bio is too long';
  END IF;
  IF p_country IS NOT NULL AND length(p_country) > 50 THEN
    RAISE EXCEPTION 'Country is too long';
  END IF;
  IF coalesce(array_length(p_ai_tools, 1), 0) < 1 THEN
    RAISE EXCEPTION 'Pick at least one AI tool';
  END IF;
  IF EXISTS (SELECT 1 FROM public.artists a WHERE a.user_id = v_user) THEN
    RAISE EXCEPTION 'Artist profile already exists';
  END IF;

  v_base_slug := lower(regexp_replace(trim(p_display_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' from v_base_slug);
  IF v_base_slug = '' THEN
    v_base_slug := 'artist';
  END IF;
  v_slug := v_base_slug || '-' || substr(v_user::text, 1, 4);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user, 'artist')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.artists (
    user_id,
    display_name,
    slug,
    bio,
    country,
    ai_tools_used,
    avatar_url,
    banner_url
  )
  VALUES (
    v_user,
    trim(p_display_name),
    v_slug,
    nullif(trim(coalesce(p_bio, '')), ''),
    nullif(trim(coalesce(p_country, '')), ''),
    p_ai_tools,
    p_avatar_url,
    p_banner_url
  )
  RETURNING artists.id INTO v_artist_id;

  RETURN QUERY SELECT v_artist_id, v_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_artist_profile(text, text, text, public.ai_tool[], text, text) TO authenticated;

-- Store only audio object paths in tracks.audio_url where possible. Permanent
-- public URLs are no longer needed once the app signs playback URLs.
UPDATE public.tracks
SET audio_url = regexp_replace(audio_url, '^.*/storage/v1/object/public/audio/', '')
WHERE audio_url LIKE '%/storage/v1/object/public/audio/%';

UPDATE storage.buckets
SET public = false
WHERE id = 'audio';

DROP POLICY IF EXISTS "audio_public_read" ON storage.objects;
DROP POLICY IF EXISTS audio_public_read ON storage.objects;
DROP POLICY IF EXISTS audio_read_for_signed_urls ON storage.objects;
CREATE POLICY audio_read_for_signed_urls
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio');

-- Browser upload policies still require artist ownership for audio writes.
-- App-side validation now limits size/type before upload.

-- Streams must go through the RPC below. It rate-limits repeat plays by the
-- same signed-in user for the same track.
DROP POLICY IF EXISTS "plays_insert_any" ON public.plays;
DROP POLICY IF EXISTS plays_insert_any ON public.plays;

CREATE OR REPLACE FUNCTION public.record_track_play(p_track_id uuid, p_country text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_recent boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tracks WHERE id = p_track_id) THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.plays
    WHERE track_id = p_track_id
      AND user_id = v_user
      AND played_at > now() - interval '10 minutes'
  )
  INTO v_recent;

  IF v_recent THEN
    RETURN false;
  END IF;

  INSERT INTO public.plays (track_id, user_id, country)
  VALUES (p_track_id, v_user, nullif(left(coalesce(p_country, ''), 8), ''));

  INSERT INTO public.listening_history (user_id, track_id)
  VALUES (v_user, p_track_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_track_play(uuid, text) TO authenticated;

-- Motivations are no longer trusted for quota unlocks until verified.
ALTER TABLE public.motivations
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid;

DROP POLICY IF EXISTS motivations_select_all ON public.motivations;
CREATE POLICY motivations_select_all
  ON public.motivations FOR SELECT
  USING (
    verified = true
    OR fan_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS motivations_update_admin ON public.motivations;
CREATE POLICY motivations_update_admin
  ON public.motivations FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Downloads are claimed through one RPC that checks quota and records use.
DROP POLICY IF EXISTS downloads_insert_own ON public.downloads;

CREATE OR REPLACE FUNCTION public.claim_download(p_track_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_used integer;
  v_verified_motivations integer;
  v_allowance integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tracks WHERE id = p_track_id) THEN
    RAISE EXCEPTION 'Track not found';
  END IF;

  SELECT count(*) INTO v_used
  FROM public.downloads
  WHERE user_id = v_user;

  SELECT count(*) INTO v_verified_motivations
  FROM public.motivations
  WHERE fan_id = v_user AND verified = true;

  v_allowance := 20 + (v_verified_motivations * 20);

  IF v_used >= v_allowance THEN
    RAISE EXCEPTION 'Download quota exceeded';
  END IF;

  INSERT INTO public.downloads (user_id, track_id)
  VALUES (v_user, p_track_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_download(uuid) TO authenticated;

-- Purchase requests must be attached to the authenticated buyer.
DROP POLICY IF EXISTS "song_purchase_requests_insert_any" ON public.song_purchase_requests;
DROP POLICY IF EXISTS song_purchase_requests_insert_own ON public.song_purchase_requests;
CREATE POLICY song_purchase_requests_insert_own
  ON public.song_purchase_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND buyer_id = auth.uid());

-- Founding subscriptions must be claimed through a locked RPC so cap checks
-- cannot be raced from multiple clients.
DROP POLICY IF EXISTS subs_insert_own_founding ON public.subscriptions;

CREATE OR REPLACE FUNCTION public.claim_founding_subscription(p_artist_id uuid, p_plan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cap integer;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM pg_advisory_xact_lock(93850301);

  IF NOT EXISTS (
    SELECT 1 FROM public.artists
    WHERE id = p_artist_id AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Artist profile not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_plans
    WHERE id = p_plan_id AND is_founding = true AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Founding plan not available';
  END IF;

  SELECT founding_artist_cap INTO v_cap
  FROM public.platform_settings
  WHERE id = 1;

  SELECT count(*) INTO v_count
  FROM public.subscriptions
  WHERE is_founding = true;

  IF v_count >= coalesce(v_cap, 0) THEN
    RAISE EXCEPTION 'Founding Artist slots are full';
  END IF;

  INSERT INTO public.subscriptions (artist_id, plan_id, is_founding, started_at)
  VALUES (p_artist_id, p_plan_id, true, now());

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_founding_subscription(uuid, uuid) TO authenticated;
