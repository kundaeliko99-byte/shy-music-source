
CREATE TABLE public.radio_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_or_genre text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  songs_played uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.radio_sessions TO authenticated;
GRANT INSERT ON public.radio_sessions TO anon;
GRANT ALL ON public.radio_sessions TO service_role;

ALTER TABLE public.radio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY radio_sessions_insert_own ON public.radio_sessions
  FOR INSERT WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY radio_sessions_select_own ON public.radio_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY radio_sessions_update_own ON public.radio_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX radio_sessions_user_idx ON public.radio_sessions(user_id, started_at DESC);
