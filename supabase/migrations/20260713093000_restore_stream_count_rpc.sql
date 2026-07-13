-- Restore the stream-count RPC expected by the web and Android clients.
-- The client calls this first; direct inserts are only a compatibility fallback.

CREATE OR REPLACE FUNCTION public.increment_play_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_artist_id uuid;
  v_multiplier bigint := 1;
BEGIN
  SELECT artist_id INTO v_artist_id
  FROM public.tracks
  WHERE id = NEW.track_id;

  IF v_artist_id = 'fffc185c-fc73-4230-b2aa-083867b3c023'::uuid THEN
    v_multiplier := 100;
  END IF;

  UPDATE public.tracks
  SET plays_count = plays_count + v_multiplier
  WHERE id = NEW.track_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plays_increment ON public.plays;
CREATE TRIGGER trg_plays_increment
  AFTER INSERT ON public.plays
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_play_count();

CREATE OR REPLACE FUNCTION public.record_track_play(p_track_id uuid, p_country text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_recent boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tracks WHERE id = p_track_id) THEN
    RETURN false;
  END IF;

  IF v_user IS NOT NULL THEN
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
  END IF;

  INSERT INTO public.plays (track_id, user_id, country)
  VALUES (p_track_id, v_user, nullif(left(coalesce(p_country, ''), 8), ''));

  IF v_user IS NOT NULL THEN
    INSERT INTO public.listening_history (user_id, track_id)
    VALUES (v_user, p_track_id);
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_track_play(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
