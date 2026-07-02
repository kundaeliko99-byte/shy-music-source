-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('listener', 'artist', 'admin');
CREATE TYPE public.ai_tool AS ENUM ('suno', 'udio', 'stable_audio', 'custom_model', 'other');
CREATE TYPE public.genre AS ENUM ('ambient','electronic','hiphop','afrobeats','classical','pop','lofi','experimental','cinematic','world');
CREATE TYPE public.mood AS ENUM ('chill','energetic','focus','melancholy','uplifting','dark');

-- ============ TIMESTAMP HELPER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_insert_own_listener" ON public.user_roles FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (role = 'listener' OR role = 'artist')
);
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin'));

-- ============ AUTO PROFILE + LISTENER ROLE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1) || '_' || substr(NEW.id::text,1,4))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'listener');
  IF (NEW.raw_user_meta_data->>'role') = 'artist' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'artist');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ARTISTS ============
CREATE TABLE public.artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  country TEXT,
  ai_tools_used public.ai_tool[] DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT false,
  banner_url TEXT,
  avatar_url TEXT,
  monthly_listeners INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "artists_select_all" ON public.artists FOR SELECT USING (true);
CREATE POLICY "artists_insert_own" ON public.artists FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(),'artist'));
CREATE POLICY "artists_update_own" ON public.artists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "artists_admin_all" ON public.artists FOR ALL USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_artists_updated BEFORE UPDATE ON public.artists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ALBUMS ============
CREATE TABLE public.albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_url TEXT,
  release_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ai_tool public.ai_tool,
  producer TEXT,
  album_type TEXT NOT NULL DEFAULT 'album', -- album | ep | single
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "albums_select_all" ON public.albums FOR SELECT USING (true);
CREATE POLICY "albums_insert_own" ON public.albums FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
);
CREATE POLICY "albums_update_own" ON public.albums FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
);
CREATE POLICY "albums_delete_own" ON public.albums FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
);
CREATE POLICY "albums_admin_all" ON public.albums FOR ALL USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_albums_updated BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRACKS ============
CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  album_id UUID REFERENCES public.albums(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  cover_url TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  genre public.genre NOT NULL,
  mood public.mood,
  ai_tool public.ai_tool NOT NULL,
  lyrics TEXT,
  explicit BOOLEAN NOT NULL DEFAULT false,
  plays_count BIGINT NOT NULL DEFAULT 0,
  release_date DATE NOT NULL DEFAULT CURRENT_DATE,
  position_in_album INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tracks_artist ON public.tracks(artist_id);
CREATE INDEX idx_tracks_genre ON public.tracks(genre);
CREATE INDEX idx_tracks_mood ON public.tracks(mood);
CREATE INDEX idx_tracks_ai_tool ON public.tracks(ai_tool);
CREATE INDEX idx_tracks_release ON public.tracks(release_date DESC);
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracks_select_all" ON public.tracks FOR SELECT USING (true);
CREATE POLICY "tracks_insert_own" ON public.tracks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
);
CREATE POLICY "tracks_update_own" ON public.tracks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
);
CREATE POLICY "tracks_delete_own" ON public.tracks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.artists a WHERE a.id = artist_id AND a.user_id = auth.uid())
);
CREATE POLICY "tracks_admin_all" ON public.tracks FOR ALL USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_tracks_updated BEFORE UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PLAYS ============
CREATE TABLE public.plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  country TEXT,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plays_track ON public.plays(track_id);
CREATE INDEX idx_plays_played_at ON public.plays(played_at DESC);
CREATE INDEX idx_plays_country ON public.plays(country);
ALTER TABLE public.plays ENABLE ROW LEVEL SECURITY;
-- anyone can record a play (anon listeners allowed); user_id must match if provided
CREATE POLICY "plays_insert_any" ON public.plays FOR INSERT WITH CHECK (
  user_id IS NULL OR auth.uid() = user_id
);
-- only admins or the owning artist can read raw plays
CREATE POLICY "plays_select_admin_or_artist" ON public.plays FOR SELECT USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (
    SELECT 1 FROM public.tracks t
    JOIN public.artists a ON a.id = t.artist_id
    WHERE t.id = plays.track_id AND a.user_id = auth.uid()
  )
);

-- increment plays_count trigger
CREATE OR REPLACE FUNCTION public.increment_play_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tracks SET plays_count = plays_count + 1 WHERE id = NEW.track_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_plays_increment AFTER INSERT ON public.plays
  FOR EACH ROW EXECUTE FUNCTION public.increment_play_count();

-- ============ LIKES ============
CREATE TABLE public.likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select_own" ON public.likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "likes_insert_own" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- ============ FOLLOWS ============
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, artist_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select_all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- ============ SAVED ALBUMS ============
CREATE TABLE public.saved_albums (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, album_id)
);
ALTER TABLE public.saved_albums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_albums_select_own" ON public.saved_albums FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_albums_insert_own" ON public.saved_albums FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_albums_delete_own" ON public.saved_albums FOR DELETE USING (auth.uid() = user_id);

-- ============ PLAYLISTS ============
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_editorial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlists_select_public_or_own" ON public.playlists FOR SELECT USING (
  is_public OR auth.uid() = user_id
);
CREATE POLICY "playlists_insert_own" ON public.playlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "playlists_update_own" ON public.playlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "playlists_delete_own" ON public.playlists FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_playlists_updated BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.playlist_tracks (
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, track_id)
);
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlist_tracks_select" ON public.playlist_tracks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (p.is_public OR p.user_id = auth.uid()))
);
CREATE POLICY "playlist_tracks_insert_own" ON public.playlist_tracks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid())
);
CREATE POLICY "playlist_tracks_delete_own" ON public.playlist_tracks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid())
);

-- ============ LISTENING HISTORY ============
CREATE TABLE public.listening_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_user_time ON public.listening_history(user_id, played_at DESC);
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history_select_own" ON public.listening_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "history_insert_own" ON public.listening_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('audio', 'audio', true),
  ('covers', 'covers', true),
  ('avatars', 'avatars', true),
  ('banners', 'banners', true);

-- audio: public read (so HTML5 audio can stream); only the uploading artist can write under their user folder
CREATE POLICY "audio_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'audio');
CREATE POLICY "audio_artist_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1] AND public.has_role(auth.uid(),'artist')
);
CREATE POLICY "audio_artist_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "audio_artist_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "covers_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "covers_user_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "covers_user_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "covers_user_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_user_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "avatars_user_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "banners_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "banners_user_write" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "banners_user_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]
);