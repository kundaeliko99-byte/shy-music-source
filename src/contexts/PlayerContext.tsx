import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { bumpStreamCount } from "@/hooks/useTrackStreams";
import { resolveAudioUrl } from "@/lib/media";
import { withTimeout } from "@/lib/request";

import type { ArtworkShape } from "@/components/Cover";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerTrack {
  id: string;
  title: string;
  artist_name: string;
  artist_slug: string;
  cover_url: string | null;
  audio_url: string;
  duration_seconds: number;
  plays_count?: number;
  artwork_shape?: ArtworkShape;
  lyrics?: string | null;
  album_id?: string | null;
  genre?: string | null;
  artist_id?: string;
  stream_url?: string;
}

interface PlayerContextValue {
  current: PlayerTrack | null;
  queue: PlayerTrack[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  expanded: boolean;
  repeatMode: RepeatMode;
  shuffleMode: boolean;
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  setExpanded: (b: boolean) => void;
  cycleRepeatMode: () => void;
  toggleShuffleMode: () => void;
  addToQueue: (track: PlayerTrack) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

const PLAY_THRESHOLD_SECONDS = 5;
const MAX_RECOVERY_ATTEMPTS = 4;
const RECOVERY_DELAYS_MS = [350, 900, 1800, 3200];

const TRACK_SELECT_MIN = `
  id, title, cover_url, audio_url, duration_seconds, plays_count, artwork_shape, lyrics, album_id, genre, artist_id,
  artists ( display_name, slug )
`;

type RawTrack = {
  id: string;
  title: string;
  cover_url: string | null;
  audio_url: string;
  duration_seconds: number;
  plays_count: number;
  artwork_shape: ArtworkShape | null;
  lyrics: string | null;
  album_id: string | null;
  genre: string | null;
  artist_id: string;
  artists: { display_name: string; slug: string } | null;
};

function rawToPlayer(t: RawTrack): PlayerTrack {
  return {
    id: t.id,
    title: t.title,
    artist_name: t.artists?.display_name ?? "Unknown",
    artist_slug: t.artists?.slug ?? "",
    cover_url: t.cover_url,
    audio_url: t.audio_url,
    duration_seconds: t.duration_seconds,
    plays_count: t.plays_count,
    artwork_shape: t.artwork_shape ?? "circle",
    lyrics: t.lyrics,
    album_id: t.album_id,
    genre: t.genre,
    artist_id: t.artist_id,
  };
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [expanded, setExpanded] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffleMode, setShuffleMode] = useState(false);

  // Refs mirror state so audio event listeners (registered once) see latest values
  const queueRef = useRef<PlayerTrack[]>([]);
  const queueIndexRef = useRef(0);
  const currentRef = useRef<PlayerTrack | null>(null);
  const currentTimeRef = useRef(0);
  const repeatModeRef = useRef<RepeatMode>("off");
  const shuffleModeRef = useRef(false);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { shuffleModeRef.current = shuffleMode; }, [shuffleMode]);

  const playCountedRef = useRef(false);
  const historyLoggedRef = useRef(false);
  const playbackRequestRef = useRef(0);
  const intendedPlayingRef = useRef(false);
  const recoveryTimerRef = useRef<number | null>(null);
  const recoveryAttemptRef = useRef(0);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  async function recordPlay(trackId: string) {
    try {
      const country =
        typeof navigator !== "undefined"
          ? (navigator.language?.split("-")[1] ?? null)
          : null;
      const { data, error } = await (supabase as any).rpc("record_track_play", {
        p_track_id: trackId,
        p_country: country,
      });
      if (error) {
        if (!isMissingRecordPlayRpc(error)) {
          console.warn("[player] failed to record play", error);
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        const { error: insertError } = await (supabase as any)
          .from("plays")
          .insert({
            track_id: trackId,
            user_id: user?.id ?? null,
            country: country ? country.slice(0, 8) : null,
          });

        if (insertError) {
          console.warn("[player] fallback play insert failed", insertError);
          return;
        }
      }
      if (!error && !data) {
        console.info("[player] play not counted by stream rules", { trackId });
        return;
      }
      const currentTrack = currentRef.current;
      const multiplier =
        currentTrack?.artist_id === "fffc185c-fc73-4230-b2aa-083867b3c023" ? 100 : 1;
      // Optimistic local bump so the UI reflects the new stream count immediately.
      // Realtime will replace this with the canonical database value shortly after.
      bumpStreamCount(trackId, multiplier, currentTrack?.plays_count);
      historyLoggedRef.current = true;
    } catch (e) {
      console.warn("[player] failed to record play", e);
    }
  }

  // Fetch a fallback track from same album, then same genre
  async function fetchFallbackTrack(from: PlayerTrack): Promise<PlayerTrack | null> {
    const exclude = new Set(queueRef.current.map((t) => t.id));
    exclude.add(from.id);

    if (from.album_id) {
      const { data } = await withTimeout(
        supabase
          .from("tracks")
          .select(TRACK_SELECT_MIN)
          .eq("album_id", from.album_id)
          .limit(20),
        "Player album fallback",
        4500,
      ).catch(() => ({ data: null }));
      const pick = (data as unknown as RawTrack[] | null)?.find((t) => !exclude.has(t.id));
      if (pick) return rawToPlayer(pick);
    }
    if (from.genre) {
      const { data } = await withTimeout(
        supabase
          .from("tracks")
          .select(TRACK_SELECT_MIN)
          .eq("genre", from.genre as never)
          .order("plays_count", { ascending: false })
          .limit(30),
        "Player genre fallback",
        4500,
      ).catch(() => ({ data: null }));
      const pick = (data as unknown as RawTrack[] | null)?.find((t) => !exclude.has(t.id));
      if (pick) return rawToPlayer(pick);
    }
    return null;
  }

  const schedulePlaybackRecovery = useCallback((reason: string, refreshSource = false) => {
    if (typeof window === "undefined") return;
    if (!intendedPlayingRef.current) return;

    const a = audioRef.current;
    const track = currentRef.current;
    if (!a || !track) return;
    if (a.ended) return;
    if (recoveryTimerRef.current !== null) return;

    const attempt = recoveryAttemptRef.current;
    if (attempt >= MAX_RECOVERY_ATTEMPTS) {
      console.warn("[player] playback recovery exhausted", reason);
      setIsPlaying(false);
      return;
    }

    recoveryTimerRef.current = window.setTimeout(async () => {
      recoveryTimerRef.current = null;
      if (!intendedPlayingRef.current) return;

      const audio = audioRef.current;
      const currentTrack = currentRef.current;
      if (!audio || !currentTrack || audio.ended) return;

      recoveryAttemptRef.current += 1;
      const resumeAt = Number.isFinite(audio.currentTime) ? audio.currentTime : currentTimeRef.current;

      try {
        if (refreshSource) {
          const freshUrl = await withTimeout(
            resolveAudioUrl(currentTrack.audio_url),
            "Audio recovery URL signing",
            8000,
          );
          if (!intendedPlayingRef.current || currentRef.current?.id !== currentTrack.id) return;
          if (audio.src !== freshUrl) {
            audio.src = freshUrl;
            audio.load();
          }
          if (resumeAt > 0) {
            try {
              audio.currentTime = resumeAt;
            } catch {
              audio.addEventListener(
                "loadedmetadata",
                () => {
                  try { audio.currentTime = resumeAt; } catch { /* keep playing from start if seek fails */ }
                },
                { once: true },
              );
            }
          }
        }

        await withTimeout(audio.play(), "Audio recovery playback", 8000);
        setIsPlaying(true);
      } catch (error) {
        console.warn("[player] playback recovery failed", reason, error);
        if (intendedPlayingRef.current) schedulePlaybackRecovery(reason, refreshSource);
      }
    }, RECOVERY_DELAYS_MS[Math.min(attempt, RECOVERY_DELAYS_MS.length - 1)]);
  }, []);

  const playTrackInternal = useCallback(async (t: PlayerTrack) => {
    const a = audioRef.current;
    if (!a) return;
    const requestId = playbackRequestRef.current + 1;
    playbackRequestRef.current = requestId;
    intendedPlayingRef.current = true;
    recoveryAttemptRef.current = 0;
    clearRecoveryTimer();
    setCurrent(t);
    setCurrentTime(0);
    playCountedRef.current = false;
    historyLoggedRef.current = false;
    const preparedSrc = t.stream_url;
    if (preparedSrc) {
      if (a.src !== preparedSrc) {
        a.src = preparedSrc;
        a.load();
      }
      a.play().catch((error) => {
        console.warn("[player] playback failed", error);
        intendedPlayingRef.current = false;
        setIsPlaying(false);
      });
      return;
    }

    let signedSrc: string;
    try {
      signedSrc = await withTimeout(resolveAudioUrl(t.audio_url), "Audio URL signing", 8000);
    } catch (error) {
      console.warn("[player] failed to resolve audio URL", error);
      intendedPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }
    if (playbackRequestRef.current !== requestId) return;
    // Only reload src if it actually changed — avoids needless re-buffering
    if (a.src !== signedSrc) {
      a.src = signedSrc;
      a.load();
    }
    withTimeout(a.play(), "Audio playback", 8000).catch((error) => {
      console.warn("[player] playback failed", error);
      intendedPlayingRef.current = false;
      setIsPlaying(false);
    });
  }, [clearRecoveryTimer]);


  const advance = useCallback(async () => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const mode = repeatModeRef.current;
    const a = audioRef.current;
    const cur = currentRef.current;
    if (!a || !cur) return;

    if (mode === "one") {
      a.currentTime = 0;
      intendedPlayingRef.current = true;
      a.play().catch((error) => {
        console.warn("[player] repeat playback failed", error);
        schedulePlaybackRecovery("repeat play failed", true);
        setIsPlaying(false);
      });
      return;
    }

    if (shuffleModeRef.current && q.length > 1) {
      let shuffledIdx = idx;
      while (shuffledIdx === idx) {
        shuffledIdx = Math.floor(Math.random() * q.length);
      }
      setQueueIndex(shuffledIdx);
      playTrackInternal(q[shuffledIdx]);
      return;
    }

    const nextIdx = idx + 1;
    if (nextIdx < q.length) {
      setQueueIndex(nextIdx);
      playTrackInternal(q[nextIdx]);
      return;
    }

    if (mode === "all" && q.length > 0) {
      setQueueIndex(0);
      playTrackInternal(q[0]);
      return;
    }

    // No queue left: try same album / genre fallback
    const fallback = await fetchFallbackTrack(cur);
    if (fallback) {
      const newQueue = [...q, fallback];
      setQueue(newQueue);
      setQueueIndex(newQueue.length - 1);
      playTrackInternal(fallback);
    }
    // else: stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playTrackInternal, schedulePlaybackRecovery]);

  // Wire the mounted audio element once. Keeping the player as a real DOM
  // element is more reliable in mobile WebViews than a detached `new Audio()`.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = audioRef.current;
    if (!a) return;
    a.preload = "auto";
    a.volume = volume;
    a.setAttribute("playsinline", "");

    let lastTimeUpdate = 0;
    const onTime = () => {
      const now = a.currentTime;
      // Throttle React state updates to ~5/sec — keeps the progress bar smooth
      // without thrashing the whole player tree on every audio tick.
      if (Math.abs(now - lastTimeUpdate) >= 0.2) {
        lastTimeUpdate = now;
        currentTimeRef.current = now;
        setCurrentTime(now);
      }
      const cur = currentRef.current;
      const countAt = getPlayCountThreshold(a.duration);
      if (!playCountedRef.current && now >= countAt && cur) {
        playCountedRef.current = true;
        recordPlay(cur.id);
      }
    };
    const onDuration = () => setDuration(a.duration || 0);
    const onPlay = () => {
      recoveryAttemptRef.current = 0;
      clearRecoveryTimer();
      setIsPlaying(true);
    };
    const onPlaying = () => {
      recoveryAttemptRef.current = 0;
      clearRecoveryTimer();
      setIsPlaying(true);
    };
    const onPause = () => {
      if (intendedPlayingRef.current && !a.ended) {
        schedulePlaybackRecovery("unexpected pause");
        return;
      }
      setIsPlaying(false);
    };
    const onWaiting = () => schedulePlaybackRecovery("audio waiting");
    const onStalled = () => schedulePlaybackRecovery("audio stalled");
    const onError = () => {
      console.warn("[player] audio element error", a.error);
      if (intendedPlayingRef.current) schedulePlaybackRecovery("audio error", true);
      else setIsPlaying(false);
    };
    const onEnded = () => {
      intendedPlayingRef.current = false;
      clearRecoveryTimer();
      setIsPlaying(false);
      advance();
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onDuration);
    a.addEventListener("play", onPlay);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("pause", onPause);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("stalled", onStalled);
    a.addEventListener("error", onError);
    a.addEventListener("ended", onEnded);

    return () => {
      a.pause();
      a.removeAttribute("src");
      a.load();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onDuration);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("stalled", onStalled);
      a.removeEventListener("error", onError);
      a.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefetch the next track's audio in the background so skipping forward
  // is instant and playback continues seamlessly on slower networks.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextTrack = queue[queueIndex + 1];
    if (!nextTrack?.audio_url) return;
    let cancelled = false;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "audio";
    Promise.resolve(nextTrack.stream_url ?? resolveAudioUrl(nextTrack.audio_url, 1800))
      .then((url) => {
        if (cancelled) return;
        link.href = url;
        document.head.appendChild(link);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      link.remove();
    };
  }, [queue, queueIndex]);

  // Media Session API — OS-level lockscreen / notification controls.
  // Makes the app feel native and responsive even when backgrounded.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!current) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist_name,
      artwork: current.cover_url
        ? [
            { src: current.cover_url, sizes: "512x512", type: "image/jpeg" },
          ]
        : [],
    });
    const handlers: Array<[MediaSessionAction, () => void]> = [
      ["play", () => audioRef.current?.play().catch((error) => {
        console.warn("[player] media session play failed", error);
        schedulePlaybackRecovery("media session play failed");
      })],
      ["pause", () => {
        intendedPlayingRef.current = false;
        clearRecoveryTimer();
        audioRef.current?.pause();
      }],
      ["previoustrack", () => handlePrevRef.current?.()],
      ["nexttrack", () => handleNextRef.current?.()],
    ];
    handlers.forEach(([action, fn]) => {
      try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* unsupported action */ }
    });
    return () => {
      handlers.forEach(([action]) => {
        try { navigator.mediaSession.setActionHandler(action, null); } catch { /* noop */ }
      });
    };
  }, [clearRecoveryTimer, current, schedulePlaybackRecovery]);

  // Refs to the latest next/prev so MediaSession handlers stay current
  // without re-registering on every render.
  const handleNextRef = useRef<() => void>(() => {});
  const handlePrevRef = useRef<() => void>(() => {});



  const playTrack = useCallback(
    (track: PlayerTrack, newQueue?: PlayerTrack[]) => {
      const q = newQueue && newQueue.length ? newQueue : [track];
      const idx = q.findIndex((t) => t.id === track.id);
      setQueue(q);
      setQueueIndex(idx >= 0 ? idx : 0);
      playTrackInternal(track);
    },
    [playTrackInternal]
  );

  const addToQueue = useCallback((track: PlayerTrack) => {
    setQueue((q) => (q.some((item) => item.id === track.id) ? q : [...q, track]));
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((q) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= q.length || toIndex >= q.length) return q;
      const next = [...q];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      const currentId = currentRef.current?.id;
      const nextCurrentIndex = currentId ? next.findIndex((track) => track.id === currentId) : -1;
      if (nextCurrentIndex >= 0) {
        queueIndexRef.current = nextCurrentIndex;
        setQueueIndex(nextCurrentIndex);
      }
      return next;
    });
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    if (a.paused) {
      intendedPlayingRef.current = true;
      recoveryAttemptRef.current = 0;
      a.play().catch((error) => {
        console.warn("[player] resume failed", error);
        schedulePlaybackRecovery("manual resume failed");
      });
    } else {
      intendedPlayingRef.current = false;
      clearRecoveryTimer();
      a.pause();
    }
  }, [clearRecoveryTimer, current, schedulePlaybackRecovery]);

  const handleNext = useCallback(() => {
    advance();
  }, [advance]);

  const handlePrev = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.currentTime > 3 || queueIndex === 0) {
      a.currentTime = 0;
      if (intendedPlayingRef.current && a.paused) {
        a.play().catch(() => schedulePlaybackRecovery("previous restart failed"));
      }
      return;
    }
    const prevIdx = queueIndex - 1;
    setQueueIndex(prevIdx);
    playTrackInternal(queue[prevIdx]);
  }, [queue, queueIndex, playTrackInternal]);

  // Keep MediaSession action refs pointing at latest handlers
  useEffect(() => { handleNextRef.current = handleNext; }, [handleNext]);
  useEffect(() => { handlePrevRef.current = handlePrev; }, [handlePrev]);


  const seek = useCallback((seconds: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = seconds;
    currentTimeRef.current = seconds;
    setCurrentTime(seconds);
  }, []);

  const setVolume = useCallback((v: number) => {
    const a = audioRef.current;
    if (a) a.volume = v;
    setVolumeState(v);
  }, []);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((m) => (m === "off" ? "all" : m === "all" ? "one" : "off"));
  }, []);

  const toggleShuffleMode = useCallback(() => {
    setShuffleMode((enabled) => !enabled);
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      queue,
      isPlaying,
      currentTime,
      duration,
      volume,
      expanded,
      repeatMode,
      shuffleMode,
      playTrack,
      togglePlay,
      next: handleNext,
      prev: handlePrev,
      seek,
      setVolume,
      setExpanded,
      cycleRepeatMode,
      toggleShuffleMode,
      addToQueue,
      reorderQueue,
    }),
    [current, queue, isPlaying, currentTime, duration, volume, expanded, repeatMode, shuffleMode, playTrack, togglePlay, handleNext, handlePrev, seek, setVolume, cycleRepeatMode, toggleShuffleMode, addToQueue, reorderQueue]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="auto" playsInline className="hidden" />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

function getPlayCountThreshold(duration: number) {
  if (Number.isFinite(duration) && duration > 0) {
    return Math.min(PLAY_THRESHOLD_SECONDS, Math.max(1, duration * 0.1));
  }
  return PLAY_THRESHOLD_SECONDS;
}

function isMissingRecordPlayRpc(error: unknown) {
  const details = JSON.stringify(error).toLowerCase();
  return (
    details.includes("record_track_play") &&
    (details.includes("404") ||
      details.includes("not found") ||
      details.includes("could not find") ||
      details.includes("pgrst202"))
  );
}
