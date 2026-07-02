
-- ============ ENUMS ============
CREATE TYPE public.subscription_period AS ENUM ('monthly','yearly','lifetime');
CREATE TYPE public.subscription_status AS ENUM ('pending','active','rejected');
CREATE TYPE public.mobile_money_network AS ENUM ('mtn','airtel','zamtel');

-- ============ subscription_plans ============
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price_zmw numeric(10,2) NOT NULL DEFAULT 0,
  period public.subscription_period NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  is_founding boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_select_all ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY plans_admin_all ON public.subscription_plans FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.subscription_plans (name, price_zmw, period, is_founding, sort_order) VALUES
  ('Founding Artist', 0, 'lifetime', true, 0),
  ('Pro', 50, 'monthly', false, 1),
  ('Premium', 150, 'monthly', false, 2);

-- ============ platform_settings ============
CREATE TABLE public.platform_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  founding_artist_cap int NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_select_all ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY settings_admin_all ON public.platform_settings FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role));
INSERT INTO public.platform_settings (id) VALUES (1);

-- ============ subscription_applications ============
CREATE TABLE public.subscription_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  amount_zmw numeric(10,2) NOT NULL,
  network public.mobile_money_network NOT NULL,
  mobile_money_number text NOT NULL,
  transaction_id text NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'pending',
  decision_note text,
  decided_at timestamptz,
  decided_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subapp_status ON public.subscription_applications(status, submitted_at DESC);
CREATE INDEX idx_subapp_artist ON public.subscription_applications(artist_id);

GRANT SELECT, INSERT, UPDATE ON public.subscription_applications TO authenticated;
GRANT ALL ON public.subscription_applications TO service_role;

ALTER TABLE public.subscription_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY subapp_select_own_or_admin ON public.subscription_applications
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY subapp_insert_own ON public.subscription_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY subapp_update_admin ON public.subscription_applications
  FOR UPDATE USING (has_role(auth.uid(),'admin'::app_role));

-- ============ subscriptions ============
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL UNIQUE REFERENCES public.artists(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  application_id uuid REFERENCES public.subscription_applications(id),
  is_founding boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subs_select_all ON public.subscriptions FOR SELECT USING (true);
CREATE POLICY subs_admin_all ON public.subscriptions FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role));
-- allow artist to self-claim founding (validated server-side via serverFn that checks slots)
CREATE POLICY subs_insert_own_founding ON public.subscriptions
  FOR INSERT WITH CHECK (
    is_founding = true
    AND EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
  );

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_select_own ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notif_update_own ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY notif_admin_all ON public.notifications FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============ TRIGGER: handle application decision ============
CREATE OR REPLACE FUNCTION public.handle_subscription_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires timestamptz;
  v_period subscription_period;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    SELECT period INTO v_period FROM public.subscription_plans WHERE id = NEW.plan_id;
    v_expires := CASE
      WHEN v_period = 'monthly' THEN now() + interval '1 month'
      WHEN v_period = 'yearly'  THEN now() + interval '1 year'
      ELSE NULL
    END;

    INSERT INTO public.subscriptions (artist_id, plan_id, application_id, is_founding, started_at, expires_at)
    VALUES (NEW.artist_id, NEW.plan_id, NEW.id, false, now(), v_expires)
    ON CONFLICT (artist_id) DO UPDATE
      SET plan_id = EXCLUDED.plan_id,
          application_id = EXCLUDED.application_id,
          started_at = now(),
          expires_at = EXCLUDED.expires_at,
          is_founding = false,
          updated_at = now();

    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.user_id,
            'Subscription approved',
            'Your SHY artist account has been approved. Welcome to SHY.',
            '/dashboard');
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.user_id,
            'Subscription rejected',
            COALESCE('Your subscription could not be verified. Please resubmit with a valid transaction ID or contact support. ' || NEW.decision_note,
                     'Your subscription could not be verified. Please resubmit with a valid transaction ID or contact support.'),
            '/dashboard');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscription_decision
  AFTER UPDATE ON public.subscription_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_subscription_decision();

-- timestamp triggers
CREATE TRIGGER trg_subapp_updated BEFORE UPDATE ON public.subscription_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
