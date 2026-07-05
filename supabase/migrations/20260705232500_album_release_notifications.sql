-- Notify listeners when an album is published live.
-- This fires when an album is inserted as already released, or when an
-- existing album is updated from future-dated to live.

CREATE OR REPLACE FUNCTION public.notify_album_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_artist_name text;
BEGIN
  IF NEW.release_date > current_date THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.release_date <= current_date
     AND OLD.title IS NOT DISTINCT FROM NEW.title THEN
    RETURN NEW;
  END IF;

  SELECT display_name
    INTO v_artist_name
    FROM public.artists
   WHERE id = NEW.artist_id;

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT p.id,
         'New album live',
         COALESCE(v_artist_name, 'An artist') || ' released ' || NEW.title || ' on SHYMusic Creative.',
         '/albums/' || NEW.id::text
    FROM public.profiles p
   WHERE p.id IS DISTINCT FROM (
     SELECT a.user_id FROM public.artists a WHERE a.id = NEW.artist_id
   )
     AND NOT EXISTS (
       SELECT 1
         FROM public.notifications n
        WHERE n.user_id = p.id
          AND n.link = '/albums/' || NEW.id::text
          AND n.title = 'New album live'
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_album_release_notifications ON public.albums;
CREATE TRIGGER trg_album_release_notifications
  AFTER INSERT OR UPDATE OF release_date, title ON public.albums
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_album_release();
