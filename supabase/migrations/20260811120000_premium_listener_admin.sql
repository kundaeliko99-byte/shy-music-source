-- Premium listener management for SHY owners/admins.
-- Kunda gets listener + artist + admin roles and an unlimited premium listener subscription.

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

CREATE OR REPLACE FUNCTION public.admin_listener_premium_rows(
  p_search text DEFAULT '',
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  username text,
  is_premium boolean,
  is_artist boolean,
  is_admin boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := lower(trim(coalesce(p_search, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text AS email,
    p.display_name,
    p.username,
    EXISTS (
      SELECT 1
      FROM public.listener_premium_subscriptions s
      WHERE s.user_id = u.id
        AND s.active = true
        AND (s.expires_at IS NULL OR s.expires_at > now())
    ) AS is_premium,
    public.has_role(u.id, 'artist'::public.app_role) AS is_artist,
    public.has_role(u.id, 'admin'::public.app_role) AS is_admin,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE v_search = ''
     OR lower(coalesce(u.email, '')) LIKE '%' || v_search || '%'
     OR lower(coalesce(p.display_name, '')) LIKE '%' || v_search || '%'
     OR lower(coalesce(p.username, '')) LIKE '%' || v_search || '%'
  ORDER BY u.created_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_listener_premium_rows(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_premium_listener_by_email(
  p_email text,
  p_premium boolean
)
RETURNS TABLE (
  user_id uuid,
  email text,
  is_premium boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No SHY account found for %', p_email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'listener'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF p_premium THEN
    UPDATE public.listener_premium_subscriptions
    SET active = true,
        expires_at = NULL,
        updated_at = now()
    WHERE user_id = v_user_id;

    IF NOT FOUND THEN
      INSERT INTO public.listener_premium_subscriptions (user_id, active, started_at, expires_at)
      VALUES (v_user_id, true, now(), NULL);
    END IF;
  ELSE
    UPDATE public.listener_premium_subscriptions
    SET active = false,
        expires_at = now(),
        updated_at = now()
    WHERE user_id = v_user_id
      AND active = true;
  END IF;

  RETURN QUERY
  SELECT
    v_user_id,
    v_email,
    EXISTS (
      SELECT 1
      FROM public.listener_premium_subscriptions s
      WHERE s.user_id = v_user_id
        AND s.active = true
        AND (s.expires_at IS NULL OR s.expires_at > now())
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_premium_listener_by_email(text, boolean) TO authenticated;

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'kundaeliko99@gmail.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES
      (v_user_id, 'listener'::public.app_role),
      (v_user_id, 'artist'::public.app_role),
      (v_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.listener_premium_subscriptions
    SET active = true,
        expires_at = NULL,
        updated_at = now()
    WHERE user_id = v_user_id;

    IF NOT FOUND THEN
      INSERT INTO public.listener_premium_subscriptions (user_id, active, started_at, expires_at)
      VALUES (v_user_id, true, now(), NULL);
    END IF;
  END IF;
END $$;
