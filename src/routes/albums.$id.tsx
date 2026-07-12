import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { BadgeCheck, CalendarDays, Disc3, Headphones, Heart, ListPlus, MoreHorizontal, Play, Share2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CDCaseAlbumCover } from "@/components/CDCaseAlbumCover";
import { Cover } from "@/components/Cover";
import { HoverPlayIcon } from "@/components/HoverPlayIcon";
import { BuySongButton } from "@/components/BuySongButton";
import { DownloadButton } from "@/components/DownloadButton";
import { EmptyState, Skeleton } from "@/components/HorizontalRow";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAlbumById, fetchAlbumTracks, toPlayerTrack, type AlbumDetail, type TrackRow } from "@/lib/api";
import { fmtCount, fmtTime } from "@/lib/format";
import { resolveAudioUrl } from "@/lib/media";
import { withTimeout } from "@/lib/request";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PlaylistOption = {
  id: string;
  title: string;
};

export const Route = createFileRoute("/albums/$id")({
  head: () => ({
    meta: [
      { title: "Album - SHY" },
      { name: "description", content: "Open a SHY album and listen to the songs inside." },
    ],
  }),
  component: AlbumDetailPage,
});

function AlbumDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { current, isPlaying, playTrack, togglePlay } = usePlayer();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [streamUrls, setStreamUrls] = useState<Record<string, string>>({});
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAlbumById(id), fetchAlbumTracks(id)]).then(([albumData, trackData]) => {
      setAlbum(albumData);
      setTracks(trackData);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!user) {
      setPlaylists([]);
      return;
    }

    supabase
      .from("playlists")
      .select("id, title")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => setPlaylists((data ?? []) as PlaylistOption[]));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setStreamUrls({});
    if (tracks.length === 0) return;

    Promise.all(
      tracks.map(async (track) => {
        try {
          const url = await withTimeout(
            resolveAudioUrl(track.audio_url, 3600),
            `Prepare audio for ${track.title}`,
            8000,
          );
          return [track.id, url] as const;
        } catch (error) {
          console.warn("[album] failed to prepare audio", track.id, error);
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setStreamUrls(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>));
    });

    return () => {
      cancelled = true;
    };
  }, [tracks]);

  const playerQueue = useMemo(
    () => tracks.map((track) => toPlayerTrack(track, streamUrls[track.id])),
    [tracks, streamUrls],
  );

  if (loading) {
    return (
      <AppShell>
        <Skeleton className="mb-6 h-64 w-full" />
      </AppShell>
    );
  }

  if (!album) {
    return (
      <AppShell>
        <EmptyState title="Album not found" hint="This album may have been removed or is not public yet." />
      </AppShell>
    );
  }

  const totalPlays = tracks.reduce((sum, track) => sum + (track.plays_count ?? 0), 0);
  const isActiveAlbum = current?.album_id === album.id;

  return (
    <AppShell>
      <section className="mb-8 grid gap-6 rounded-2xl bg-gradient-hero p-5 hairline animate-in fade-in-0 slide-in-from-bottom-2 duration-300 md:grid-cols-[240px_1fr] md:items-end sm:p-7">
        <CDCaseAlbumCover src={album.cover_url} seed={album.id} className="mx-auto w-full max-w-[250px]">
          {tracks[0] && (
            <HoverPlayIcon
              label={`Play album ${album.title}`}
              text="Play album"
              active={isActiveAlbum}
              playing={isPlaying}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (isActiveAlbum) togglePlay();
                else playTrack(toPlayerTrack(tracks[0], streamUrls[tracks[0].id]), playerQueue);
              }}
            />
          )}
        </CDCaseAlbumCover>

        <div className="min-w-0">
          <div className="mb-2 text-[10px] font-medium tracking-[0.25em] text-primary-glow">
            {album.release_type?.toUpperCase() || "ALBUM"}
          </div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{album.title}</h1>
          {album.artists && (
            <Link
              to="/artists/$slug"
              params={{ slug: album.artists.slug }}
              aria-label={`Open artist profile for ${album.artists.display_name}`}
              className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {album.artists.avatar_url && <img src={album.artists.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />}
              <span>{album.artists.display_name}</span>
              {album.artists.verified && <BadgeCheck className="h-4 w-4 text-primary-glow" />}
            </Link>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 hairline">
              <Disc3 className="h-3.5 w-3.5" />
              {tracks.length} {tracks.length === 1 ? "song" : "songs"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 hairline">
              <Headphones className="h-3.5 w-3.5" />
              {fmtCount(totalPlays)} streams
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 hairline">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(album.release_date).getFullYear()}
            </span>
          </div>
        </div>
      </section>

      <section className="mb-8">
        {tracks.length === 0 ? (
          <EmptyState title="No songs have been added to this album yet." hint="Songs will appear here when the artist adds them." />
        ) : (
          <div className="grid gap-3">
            {tracks.map((track, index) => (
              <AlbumSongRow
                key={track.id}
                track={track}
                index={index}
                queue={tracks}
                userId={user?.id ?? null}
                playlists={playlists}
                setPlaylists={setPlaylists}
                streamUrl={streamUrls[track.id]}
                onPlay={() => playTrack(toPlayerTrack(track, streamUrls[track.id]), playerQueue)}
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function AlbumSongRow({
  track,
  index,
  queue,
  userId,
  playlists,
  setPlaylists,
  streamUrl,
  onPlay,
}: {
  track: TrackRow;
  index: number;
  queue: TrackRow[];
  userId: string | null;
  playlists: PlaylistOption[];
  setPlaylists: Dispatch<SetStateAction<PlaylistOption[]>>;
  streamUrl?: string;
  onPlay: () => void;
}) {
  const { current, isPlaying, togglePlay, addToQueue } = usePlayer();
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isCurrent = current?.id === track.id;
  const playerTrack = toPlayerTrack(track, streamUrl);

  const playOrPause = () => {
    if (isCurrent) togglePlay();
    else onPlay();
  };

  const shareTrack = async () => {
    const url = `${window.location.origin}/tracks/${track.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Track link copied");
    } catch {
      toast.info(url);
    }
  };

  const saveToPlaylist = async (playlistId?: string) => {
    if (!userId) {
      toast.info("Sign in to save songs to a playlist.");
      return;
    }

    let targetId = playlistId ?? playlists[0]?.id;
    if (!targetId) {
      const { data: created, error } = await supabase
        .from("playlists")
        .insert({
          user_id: userId,
          title: "Saved Songs",
          description: "Songs saved from albums.",
          is_public: false,
        })
        .select("id, title")
        .maybeSingle();

      if (error || !created) {
        toast.error("Couldn't create playlist.");
        return;
      }

      const playlist = created as PlaylistOption;
      setPlaylists((currentPlaylists) => [playlist, ...currentPlaylists]);
      targetId = playlist.id;
    }

    const { data: existing } = await supabase
      .from("playlist_tracks")
      .select("track_id")
      .eq("playlist_id", targetId)
      .eq("track_id", track.id)
      .maybeSingle();

    if (existing) {
      toast.info("Already in playlist.");
      return;
    }

    const { error } = await supabase
      .from("playlist_tracks")
      .insert({ playlist_id: targetId, track_id: track.id, position: 0 });

    if (error) {
      toast.error("Couldn't add to playlist.");
      return;
    }

    toast.success("Added to playlist");
  };

  return (
    <div
      data-album-song-row={track.id}
      data-stream-ready={streamUrl ? "true" : "false"}
      onClick={playOrPause}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      className={`group grid cursor-pointer grid-cols-[2rem_4.25rem_1fr] items-center gap-3 rounded-lg bg-surface p-3 hairline transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:grid-cols-[2rem_5rem_1fr_auto] ${isCurrent ? "border-primary/40" : ""}`}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          playOrPause();
        }}
        aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.title}`}
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs text-muted-foreground transition-transform active:scale-90 group-hover:text-primary"
      >
        <span className="group-hover:hidden">
          {isCurrent && isPlaying ? <span className="block h-1.5 w-1.5 rounded-full bg-primary" /> : index + 1}
        </span>
        <Play className="hidden h-4 w-4 fill-current group-hover:block" />
      </button>
      <div className="relative" aria-hidden="true">
        <Cover src={track.cover_url} seed={track.id} shape={track.artwork_shape ?? "circle"} className="aspect-square w-full" />
      </div>
      <div className="min-w-0">
        <div className={`truncate text-sm font-medium transition-colors ${isCurrent && isPlaying ? "text-primary-glow" : ""}`}>
          {track.title}
        </div>
        {track.artists && (
          <div className="truncate text-xs text-muted-foreground">
            {track.artists.display_name}
          </div>
        )}
        <div className="mt-1 text-[11px] text-muted-foreground">{fmtCount(track.plays_count)} streams</div>
      </div>
      <div className="col-span-3 flex flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSaved((value) => !value);
          }}
          aria-label={saved ? `Remove ${track.title} from saved songs` : `Save ${track.title}`}
          aria-pressed={saved}
          className={`h-8 w-8 rounded-full hairline flex items-center justify-center opacity-0 transition active:scale-90 group-hover:opacity-100 focus:opacity-100 ${saved ? "text-primary bg-primary/15 border-primary/40 opacity-100" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </button>
        <TrackOptionsMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          track={track}
          onAddToQueue={() => {
            addToQueue(playerTrack);
            toast.success("Added to queue");
          }}
          playlists={playlists}
          onAddToPlaylist={saveToPlaylist}
          onShare={shareTrack}
        />
        <span className="min-w-10 text-right text-xs text-muted-foreground">{fmtTime(track.duration_seconds)}</span>
        <span onClick={(event) => event.stopPropagation()}>
          <DownloadButton trackId={track.id} title={track.title} audioUrl={track.audio_url} artistId={track.artist_id} size="sm" />
        </span>
        <span onClick={(event) => event.stopPropagation()}>
          <BuySongButton track={track} size="sm" />
        </span>
      </div>
    </div>
  );
}

function TrackOptionsMenu({
  open,
  onOpenChange,
  track,
  onAddToQueue,
  playlists,
  onAddToPlaylist,
  onShare,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: TrackRow;
  onAddToQueue: () => void;
  playlists: PlaylistOption[];
  onAddToPlaylist: (playlistId?: string) => void;
  onShare: () => void;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`More options for ${track.title}`}
          className="h-8 w-8 rounded-full hairline flex items-center justify-center text-muted-foreground opacity-0 transition hover:text-foreground active:scale-90 group-hover:opacity-100 focus:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 bg-surface text-foreground hairline">
        <DropdownMenuItem onClick={onAddToQueue}>
          <ListPlus className="h-4 w-4 text-primary" />
          Add to queue
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Heart className="h-4 w-4" />
            Add to playlist
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-44 bg-surface text-foreground hairline">
            {playlists.length === 0 ? (
              <DropdownMenuItem onClick={() => onAddToPlaylist()}>
                Create Saved Songs
              </DropdownMenuItem>
            ) : (
              playlists.map((playlist) => (
                <DropdownMenuItem key={playlist.id} onClick={() => onAddToPlaylist(playlist.id)}>
                  {playlist.title}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {track.artists && (
          <DropdownMenuItem asChild>
            <Link to="/artists/$slug" params={{ slug: track.artists.slug }}>
              <UserRound className="h-4 w-4" />
              Go to artist
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onShare}>
          <Share2 className="h-4 w-4" />
          Share
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
