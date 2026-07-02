-- Attach the existing increment_play_count function as a trigger on plays inserts
DROP TRIGGER IF EXISTS plays_increment_count ON public.plays;
CREATE TRIGGER plays_increment_count
AFTER INSERT ON public.plays
FOR EACH ROW
EXECUTE FUNCTION public.increment_play_count();

-- Enable realtime broadcasts on tracks so clients can react to plays_count changes
ALTER TABLE public.tracks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracks;