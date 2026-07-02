-- Song marketplace support for Buy Song flow.

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS public_phone text,
  ADD COLUMN IF NOT EXISTS preferred_payment_method text;

CREATE TABLE IF NOT EXISTS public.track_sale_terms (
  track_id uuid PRIMARY KEY REFERENCES public.tracks(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  is_available boolean NOT NULL DEFAULT true,
  sale_type text NOT NULL DEFAULT 'negotiable'
    CHECK (sale_type IN ('full', 'partial', 'negotiable')),
  asking_price numeric(12, 2),
  currency text NOT NULL DEFAULT 'USD',
  seller_royalty_percentage numeric(5, 2)
    CHECK (seller_royalty_percentage IS NULL OR (seller_royalty_percentage >= 0 AND seller_royalty_percentage <= 100)),
  buyer_rights text[] NOT NULL DEFAULT ARRAY['record','remix','edit','perform','distribute','publish','commercially use'],
  restrictions text,
  extra_notes text,
  contract_terms text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.track_sale_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "track_sale_terms_select_all" ON public.track_sale_terms;
CREATE POLICY "track_sale_terms_select_all"
  ON public.track_sale_terms FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "track_sale_terms_insert_own" ON public.track_sale_terms;
CREATE POLICY "track_sale_terms_insert_own"
  ON public.track_sale_terms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "track_sale_terms_update_own" ON public.track_sale_terms;
CREATE POLICY "track_sale_terms_update_own"
  ON public.track_sale_terms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trg_track_sale_terms_updated ON public.track_sale_terms;
CREATE TRIGGER trg_track_sale_terms_updated
  BEFORE UPDATE ON public.track_sale_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.song_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_name text,
  buyer_contact text,
  requested_payment_method text,
  proposed_price numeric(12, 2),
  currency text DEFAULT 'USD',
  message text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.song_purchase_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "song_purchase_requests_insert_any" ON public.song_purchase_requests;
CREATE POLICY "song_purchase_requests_insert_any"
  ON public.song_purchase_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "song_purchase_requests_artist_select" ON public.song_purchase_requests;
CREATE POLICY "song_purchase_requests_artist_select"
  ON public.song_purchase_requests FOR SELECT
  USING (
    buyer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "song_purchase_requests_artist_update" ON public.song_purchase_requests;
CREATE POLICY "song_purchase_requests_artist_update"
  ON public.song_purchase_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.artists a
      WHERE a.id = artist_id
        AND a.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP TRIGGER IF EXISTS trg_song_purchase_requests_updated ON public.song_purchase_requests;
CREATE TRIGGER trg_song_purchase_requests_updated
  BEFORE UPDATE ON public.song_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
