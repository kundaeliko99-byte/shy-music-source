-- Verify the first artist (KOPA & DJ Ottuza) and set 10k listeners
UPDATE public.artists
SET verified = true,
    monthly_listeners = 10000
WHERE id = 'fffc185c-fc73-4230-b2aa-083867b3c023';

-- Update the play-count trigger so plays for this artist's tracks count 200x
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
    v_multiplier := 200;
  END IF;
  UPDATE public.tracks
    SET plays_count = plays_count + v_multiplier
    WHERE id = NEW.track_id;
  RETURN NEW;
END;
$function$;

-- Backfill: recompute plays_count for this featured artist's tracks based on existing plays * 200
UPDATE public.tracks t
SET plays_count = COALESCE((SELECT COUNT(*) FROM public.plays p WHERE p.track_id = t.id), 0) * 200
WHERE t.artist_id = 'fffc185c-fc73-4230-b2aa-083867b3c023'::uuid;