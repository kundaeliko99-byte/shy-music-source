-- Redo SHY notable feature rules:
-- - KOPA & DJ Ottuza verified, 18k fans, 100x stream multiplier
-- - 10 free downloads per month
-- - unlimited downloads for premium listeners

UPDATE public.artists
SET verified = true,
    monthly_listeners = 18000
WHERE id = 'fffc185c-fc73-4230-b2aa-083867b3c023';

CREATE OR REPLACE FUNCTION public.increment_play_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_artist_id uuid;
  v_multiplier bigint := 1;
BEGIN
  SELECT artist_id INTO v_artist_id FROM public.tracks WHERE id = NEW.track_id;
  IF v_artist_id = 'fffc185c-fc73-4230-b2aa-083867b3c023'::uuid THEN
    v_multiplier := 100;
  END IF;

  UPDATE public.tracks
  SET plays_count = plays_count + v_multiplier
  WHERE id = NEW.track_id;

  RETURN NEW;
END;
$function$;

UPDATE public.tracks t
SET plays_count = COALESCE((SELECT COUNT(*) FROM public.plays p WHERE p.track_id = t.id), 0) * 100
WHERE t.artist_id = 'fffc185c-fc73-4230-b2aa-083867b3c023'::uuid;

CREATE TABLE IF NOT EXISTS public.listener_premium_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listener_premium_subscriptions_user_active_idx
  ON public.listener_premium_subscriptions (user_id, active, expires_at);

ALTER TABLE public.listener_premium_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listener_premium_select_own ON public.listener_premium_subscriptions;
CREATE POLICY listener_premium_select_own
  ON public.listener_premium_subscriptions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS listener_premium_admin_all ON public.listener_premium_subscriptions;
CREATE POLICY listener_premium_admin_all
  ON public.listener_premium_subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.is_premium_listener()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.listener_premium_subscriptions s
    WHERE s.user_id = auth.uid()
      AND s.active = true
      AND (s.expires_at IS NULL OR s.expires_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_premium_listener() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_download(p_track_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_used integer;
  v_is_premium boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tracks WHERE id = p_track_id) THEN
    RAISE EXCEPTION 'Track not found';
  END IF;

  SELECT public.is_premium_listener() INTO v_is_premium;

  IF NOT v_is_premium THEN
    SELECT count(*) INTO v_used
    FROM public.downloads
    WHERE user_id = v_user
      AND created_at >= date_trunc('month', now());

    IF v_used >= 10 THEN
      RAISE EXCEPTION 'Monthly download quota exceeded';
    END IF;
  END IF;

  INSERT INTO public.downloads (user_id, track_id)
  VALUES (v_user, p_track_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_download(uuid) TO authenticated;
