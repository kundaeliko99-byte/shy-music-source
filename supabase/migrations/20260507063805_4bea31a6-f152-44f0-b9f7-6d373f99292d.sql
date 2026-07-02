
CREATE TABLE public.downloads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  track_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_downloads_user_created ON public.downloads (user_id, created_at DESC);

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY downloads_select_own ON public.downloads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY downloads_insert_own ON public.downloads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
