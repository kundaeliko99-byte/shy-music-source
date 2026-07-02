import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MotivateArtist } from "@/components/MotivateButton";

const cache = new Map<string, MotivateArtist>();
const inflight = new Map<string, Promise<MotivateArtist | null>>();

/** Fetches motivation-related artist fields by id, with simple in-memory caching. */
export function useMotivateArtist(artistId: string | undefined) {
  const [artist, setArtist] = useState<MotivateArtist | null>(
    artistId ? cache.get(artistId) ?? null : null,
  );

  useEffect(() => {
    if (!artistId) return;
    const cached = cache.get(artistId);
    if (cached) { setArtist(cached); return; }

    let active = true;
    let p = inflight.get(artistId);
    if (!p) {
      p = (async () => {
        const { data } = await supabase
          .from("artists")
          .select("id, display_name, slug, avatar_url, mobile_money_number, mobile_money_network")
          .eq("id", artistId)
          .maybeSingle();
        if (data) cache.set(artistId, data as MotivateArtist);
        inflight.delete(artistId);
        return (data as MotivateArtist | null) ?? null;
      })();
      inflight.set(artistId, p);
    }
    p.then((d) => { if (active) setArtist(d); });
    return () => { active = false; };
  }, [artistId]);

  return artist;
}

/** Subscribes to live motivation count for an artist. */
export function useMotivationCount(artistId: string | undefined, initial = 0) {
  const [count, setCount] = useState(initial);

  useEffect(() => {
    if (!artistId) return;
    let active = true;
    supabase
      .from("motivations")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .then(({ count: c }) => { if (active && c != null) setCount(c); });

    const ch = supabase
      .channel(`motivations:${artistId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "motivations", filter: `artist_id=eq.${artistId}` },
        () => { if (active) setCount((n) => n + 1); },
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, [artistId]);

  return { count, bump: () => setCount((n) => n + 1) };
}
