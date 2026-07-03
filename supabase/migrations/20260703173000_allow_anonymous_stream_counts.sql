-- Keep public discovery stream counts moving: anonymous listeners can count
-- plays, while signed-in listeners still get repeat-play throttling and history.
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
