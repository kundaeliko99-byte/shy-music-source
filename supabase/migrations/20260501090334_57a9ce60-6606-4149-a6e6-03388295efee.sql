-- Artwork shape per track and album
CREATE TYPE public.artwork_shape AS ENUM ('circle', 'rounded', 'diamond', 'hexagon');

ALTER TABLE public.tracks
  ADD COLUMN artwork_shape public.artwork_shape NOT NULL DEFAULT 'circle';

ALTER TABLE public.albums
  ADD COLUMN artwork_shape public.artwork_shape NOT NULL DEFAULT 'circle',
  ADD COLUMN release_type text NOT NULL DEFAULT 'album';

-- Constrain release_type to allowed labels
ALTER TABLE public.albums
  ADD CONSTRAINT albums_release_type_check
  CHECK (release_type IN ('album','ep','mixtape'));