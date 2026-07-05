-- Admin control center support: moderation status, account status, and audit logging.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
  CHECK (account_status IN ('active', 'suspended', 'banned'));

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active'
  CHECK (moderation_status IN ('active', 'hidden', 'suspended'));

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active'
  CHECK (moderation_status IN ('active', 'hidden', 'removed'));

ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active'
  CHECK (moderation_status IN ('active', 'hidden', 'removed'));

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id uuid,
  previous_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_action_logs_admin_select ON public.admin_action_logs;
CREATE POLICY admin_action_logs_admin_select
  ON public.admin_action_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS admin_action_logs_admin_insert ON public.admin_action_logs;
CREATE POLICY admin_action_logs_admin_insert
  ON public.admin_action_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

DROP POLICY IF EXISTS profiles_admin_update_status ON public.profiles;
CREATE POLICY profiles_admin_update_status
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS track_moderation_admin_update ON public.tracks;
CREATE POLICY track_moderation_admin_update
  ON public.tracks FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS album_moderation_admin_update ON public.albums;
CREATE POLICY album_moderation_admin_update
  ON public.albums FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
