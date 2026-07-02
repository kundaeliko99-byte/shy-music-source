import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Global realtime store of live `plays_count` per track id.
 * A single Supabase channel subscribes to UPDATEs on `public.tracks` and
 * broadcasts to all subscribed React components.
 */
type Listener = (counts: Map<string, number>) => void;

const counts = new Map<string, number>();
const listeners = new Set<Listener>();
let channel: ReturnType<typeof supabase.channel> | null = null;

function ensureSubscribed() {
  if (channel) return;
  channel = supabase
    .channel("tracks-streams")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "tracks" },
      (payload) => {
        const row = payload.new as { id?: string; plays_count?: number };
        if (!row?.id || typeof row.plays_count !== "number") return;
        counts.set(row.id, row.plays_count);
        const snapshot = new Map(counts);
        for (const l of listeners) l(snapshot);
      }
    )
    .subscribe();
}

/** Returns the live `plays_count` for a track, falling back to `initial`. */
export function useLiveStreamCount(trackId: string | undefined, initial: number): number {
  const [value, setValue] = useState<number>(() =>
    trackId ? counts.get(trackId) ?? initial : initial
  );

  useEffect(() => {
    if (!trackId) return;
    ensureSubscribed();
    // Sync if a newer value arrived before mount
    const cached = counts.get(trackId);
    if (cached != null && cached !== value) setValue(cached);

    const listener: Listener = (snap) => {
      const v = snap.get(trackId);
      if (v != null) setValue(v);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  // If `initial` rises (e.g. fresh fetch) and no live value yet, prefer the higher one
  useEffect(() => {
    if (!trackId) return;
    const cached = counts.get(trackId);
    if (cached == null && initial > value) setValue(initial);
  }, [initial, trackId, value]);

  return value;
}

/** Optimistically bump a track's stream count locally (e.g. right after recording a play). */
export function bumpStreamCount(trackId: string, delta = 1) {
  const cur = counts.get(trackId) ?? 0;
  counts.set(trackId, cur + delta);
  const snapshot = new Map(counts);
  for (const l of listeners) l(snapshot);
}
