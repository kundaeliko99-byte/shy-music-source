-- Add mobile money fields to artists
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS mobile_money_number text,
  ADD COLUMN IF NOT EXISTS mobile_money_network text;

ALTER TABLE public.artists
  ADD CONSTRAINT artists_mobile_money_network_check
  CHECK (mobile_money_network IS NULL OR mobile_money_network IN ('mtn','airtel','zamtel'));

-- Motivations table (engagement log)
CREATE TABLE IF NOT EXISTS public.motivations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id uuid NOT NULL,
  fan_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS motivations_artist_id_idx ON public.motivations(artist_id);

ALTER TABLE public.motivations ENABLE ROW LEVEL SECURITY;

CREATE POLICY motivations_select_all
  ON public.motivations FOR SELECT
  USING (true);

CREATE POLICY motivations_insert_any
  ON public.motivations FOR INSERT
  WITH CHECK (fan_id IS NULL OR auth.uid() = fan_id);

CREATE POLICY motivations_admin_all
  ON public.motivations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));