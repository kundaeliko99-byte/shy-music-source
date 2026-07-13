import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, UserPlus, UserCheck, BadgeCheck, Camera, Trophy, Instagram, Twitter, Youtube, Facebook, Mail, Pencil, Check, X, Heart, Headphones, Download, Disc3, Music as MusicIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AlbumCard } from "@/components/AlbumCard";
import { Cover } from "@/components/Cover";
import { HoverPlayIcon } from "@/components/HoverPlayIcon";

import { Skeleton } from "@/components/HorizontalRow";
import { MotivateButton, networkLabel } from "@/components/MotivateButton";
import { DownloadButton } from "@/components/DownloadButton";
import { useMotivationCount } from "@/hooks/useMotivate";
import { useLiveStreamCount, useLiveStreamCounts } from "@/hooks/useTrackStreams";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchArtistBySlug, fetchArtistTracks, toPlayerTrack, type TrackRow } from "@/lib/api";
import { fmtCount } from "@/lib/format";

export const Route = createFileRoute("/artists/$slug")({
  head: () => ({
    meta: [
      { title: "Artist — SHY" },
      { name: "description", content: "Artist on SHY — listen, follow, and explore their tracks." },
    ],
  }),
  component: ArtistPage,
});

interface Artist {
  id: string;
  display_name: string;
  slug: string;
  bio: string | null;
  country: string | null;
  ai_tools_used: string[] | null;
  verified: boolean;
  banner_url: string | null;
  avatar_url: string | null;
  monthly_listeners: number;
  user_id: string;
  instagram_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  contact_email: string | null;
  mobile_money_number: string | null;
  mobile_money_network: string | null;
}

function ArtistPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [albums, setAlbums] = useState<Array<{ id: string; title: string; cover_url: string | null; release_type: string; artwork_shape: "circle" | "rounded" | "diamond" | "hexagon"; release_date: string; track_count: number }>>([]);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bestFanWeekPlays, setBestFanWeekPlays] = useState<number[]>([]);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const isOwner = !!user && !!artist && artist.user_id === user.id;
  const isBestFan = qualifiesForBestFan(bestFanWeekPlays);
  const { count: motivationCount, bump: bumpMotivation } = useMotivationCount(artist?.id);
  const liveTrackCounts = useLiveStreamCounts(tracks);
  const totalStreams = tracks.reduce((sum, track) => sum + (liveTrackCounts.get(track.id) ?? track.plays_count ?? 0), 0);

  useEffect(() => {
    setLoading(true);
    fetchArtistBySlug(slug).then(async (a) => {
      setArtist(a as Artist | null);
      setLoading(false);
      if (a) {
        const [t, { count }, mine, albumsRes] = await Promise.all([
          fetchArtistTracks(a.id, 24),
          supabase.from("follows").select("artist_id", { count: "exact", head: true }).eq("artist_id", a.id),
          user
            ? supabase.from("follows").select("artist_id").eq("artist_id", a.id).eq("follower_id", user.id).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from("albums")
            .select("id, title, cover_url, release_type, artwork_shape, release_date, tracks(count)")
            .eq("artist_id", a.id)
            .order("release_date", { ascending: false }),
        ]);
        setTracks(t);
        setFollowerCount(count ?? 0);
        setFollowing(!!mine.data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAlbums(((albumsRes.data ?? []) as any[]).map((al) => ({
          id: al.id, title: al.title, cover_url: al.cover_url,
          release_type: al.release_type ?? "album",
          artwork_shape: al.artwork_shape ?? "circle",
          release_date: al.release_date,
          track_count: al.tracks?.[0]?.count ?? 0,
        })));

        if (user && t.length > 0) {
          const trackIds = t.map((x) => x.id);
          const weekStart = sevenDayWindowStart();
          const { data: plays } = await supabase
            .from("listening_history")
            .select("played_at")
            .eq("user_id", user.id)
            .in("track_id", trackIds)
            .gte("played_at", weekStart.toISOString());
          setBestFanWeekPlays(countDailyPlays((plays ?? []) as Array<{ played_at: string }>, weekStart));
        } else {
          setBestFanWeekPlays([]);
        }
      }
    });
  }, [slug, user]);

  async function uploadArtistImage(kind: "avatar" | "banner", file: File) {
    if (!user || !artist) return;
    const bucket = kind === "avatar" ? "avatars" : "banners";
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); return; }
    const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const payload = kind === "avatar" ? { avatar_url: url } : { banner_url: url };
    const { error } = await supabase.from("artists").update(payload).eq("id", artist.id);
    if (error) { toast.error(error.message); return; }
    const field = kind === "avatar" ? "avatar_url" : "banner_url";
    setArtist({ ...artist, [field]: url } as Artist);
    toast.success(`${kind === "avatar" ? "Profile photo" : "Banner"} updated`);
  }

  async function toggleFollow() {
    if (!user) { navigate({ to: "/auth" }); return; }
    if (!artist) return;
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("artist_id", artist.id);
      setFollowing(false);
      setFollowerCount((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, artist_id: artist.id });
      setFollowing(true);
      setFollowerCount((n) => n + 1);
      toast.success(`Following ${artist.display_name}`);
    }
  }

  if (loading) {
    return <AppShell><Skeleton className="h-48 w-full mb-6" /></AppShell>;
  }
  if (!artist) {
    return <AppShell><div className="text-center text-sm text-muted-foreground py-20">Artist not found.</div></AppShell>;
  }

  

  return (
    <AppShell>
      {/* Banner */}
      <div className="relative bg-gradient-hero hairline rounded-2xl overflow-hidden mb-6 min-h-[300px]">
        {artist.banner_url ? (
          <img src={artist.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0 bg-aurora opacity-50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        {isOwner && (
          <button
            onClick={() => bannerInput.current?.click()}
            className="absolute top-3 right-3 z-10 bg-background/80 hairline text-xs px-2.5 py-1.5 rounded-full inline-flex items-center gap-1 hover:bg-background"
          >
            <Camera className="w-3 h-3" /> Banner
          </button>
        )}
        <input
          ref={bannerInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadArtistImage("banner", f); }}
        />
        <div className="relative min-h-[300px] p-5 sm:p-8 flex flex-col sm:flex-row items-start sm:items-end gap-5">
          <div className="relative shrink-0">
            <Cover src={artist.avatar_url} seed={artist.id} size={120} shape="circle" glow />
            {isOwner && (
              <>
                <button
                  onClick={() => avatarInput.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow"
                  title="Change profile photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadArtistImage("avatar", f); }}
                />
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] tracking-[0.25em] text-primary-glow font-medium mb-1">
              ARTIST
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight">{artist.display_name}</h1>
              {artist.verified && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
                  title="Verified artist"
                >
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Verified
                </span>
              )}
              {isBestFan && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/40"
                  title="Best Fan: 20+ plays every day for the last 7 days"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Best Fan
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {fmtCount(followerCount)} followers · {fmtCount(artist.monthly_listeners)} fans
              {artist.country && ` · ${artist.country}`}
            </div>
            {/* Stats */}
            <div className="flex flex-wrap gap-2 mt-3">
              <StatChip icon={<Headphones className="w-3 h-3" />} label="streams" value={fmtCount(totalStreams)} />
              <StatChip icon={<MusicIcon className="w-3 h-3" />} label={tracks.length === 1 ? "song" : "songs"} value={String(tracks.length)} />
              <StatChip icon={<Disc3 className="w-3 h-3" />} label={albums.length === 1 ? "album" : "albums"} value={String(albums.length)} />
            </div>
            {motivationCount > 0 && (
              <div className="text-xs text-primary-glow mt-2 inline-flex items-center gap-1">
                <Heart className="w-3 h-3 fill-current" />
                {fmtCount(motivationCount)} {motivationCount === 1 ? "fan has" : "fans have"} motivated this artist
              </div>
            )}
            {artist.ai_tools_used && artist.ai_tools_used.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {artist.ai_tools_used.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary-glow border border-primary/30">
                    Made with · {prettyTool(t)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {tracks[0] && (
              <button
                onClick={() => playTrack(toPlayerTrack(tracks[0]), tracks.map(toPlayerTrack))}
                className="bg-gradient-primary text-primary-foreground px-4 py-2 rounded-full text-xs font-medium inline-flex items-center gap-1.5 shadow-glow-soft"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Play
              </button>
            )}
            <button
              onClick={toggleFollow}
              className={`px-4 py-2 rounded-full text-xs font-medium hairline inline-flex items-center gap-1.5 transition-transform active:scale-95 ${
                following ? "bg-primary/20 text-primary-glow border-primary/40" : "text-foreground"
              }`}
            >
              {following ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              {following ? "Following" : "Follow"}
            </button>
            <MotivateButton
              artist={{
                id: artist.id,
                display_name: artist.display_name,
                slug: artist.slug,
                avatar_url: artist.avatar_url,
                mobile_money_number: artist.mobile_money_number,
                mobile_money_network: artist.mobile_money_network,
              }}
              onMotivated={bumpMotivation}
            />
          </div>
        </div>
      </div>

      {tracks.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Popular</h2>
            <span className="text-xs text-muted-foreground">{tracks.length} {tracks.length === 1 ? "song" : "songs"}</span>
          </div>
          <div className="bg-surface hairline rounded-xl overflow-hidden">
            {tracks.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-3 py-2.5 hairline-b last:border-b-0 hover:bg-surface-elevated transition-colors group"
              >
                <div className="w-5 text-center text-xs text-muted-foreground">{i + 1}</div>
                <div className="relative h-12 w-12 shrink-0">
                  <Link
                    to="/tracks/$id"
                    params={{ id: t.id }}
                    aria-label={`Open song page for ${t.title}`}
                    className="block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <Cover src={t.cover_url} seed={t.id} size={48} shape={t.artwork_shape ?? "circle"} />
                  </Link>
                  <HoverPlayIcon
                    label={`Play song ${t.title}`}
                    text="Play song"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      playTrack(toPlayerTrack(t), tracks.map(toPlayerTrack));
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    to="/tracks/$id"
                    params={{ id: t.id }}
                    aria-label={`Open song page for ${t.title}`}
                    className="text-sm font-medium truncate block hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {t.title}
                  </Link>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                    <LiveTrackStreams track={t} />
                    <span className="inline-flex items-center gap-1"><Download className="w-2.5 h-2.5" />0</span>
                  </div>
                </div>
                <DownloadButton trackId={t.id} title={t.title} audioUrl={t.audio_url} artistId={t.artist_id} size="sm" />
              </div>
            ))}
          </div>
        </section>
      )}

      {albums.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Discography</h2>
            <span className="text-xs text-muted-foreground">{albums.length} {albums.length === 1 ? "album" : "albums"}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((al) => (
              <div key={al.id} className="group relative">
                <AlbumCard
                  album={{
                    ...al,
                    artists: {
                      display_name: artist.display_name,
                      slug: artist.slug,
                      verified: artist.verified,
                      avatar_url: artist.avatar_url,
                    },
                    total_plays: 0,
                  }}
                  className="w-full"
                />
                {isOwner && (
                  <AlbumCoverEditor
                    album={al}
                    userId={user!.id}
                    onUpdated={(url) => setAlbums((prev) => prev.map((x) => x.id === al.id ? { ...x, cover_url: url } : x))}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <ArtistAboutSection artist={artist} isOwner={isOwner} onUpdate={(patch) => setArtist({ ...artist, ...patch } as Artist)} />

      {tracks.length === 0 && albums.length === 0 && (
        <div className="text-sm text-muted-foreground py-8 text-center bg-surface hairline rounded-xl mb-8">
          {artist.display_name} hasn't released any tracks yet.
        </div>
      )}

      {/* Motivation footer */}
      <section className="bg-gradient-to-br from-primary/10 via-surface to-surface hairline rounded-xl p-6 text-center mb-4">
        <Heart className="w-6 h-6 mx-auto text-primary-glow fill-current mb-2" />
        <div className="text-sm font-semibold">
          {motivationCount > 0
            ? `${fmtCount(motivationCount)} ${motivationCount === 1 ? "fan has" : "fans have"} motivated this artist`
            : "Be the first to motivate this artist"}
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
          Send your appreciation directly to {artist.display_name} via mobile money.
        </p>
        <div className="flex justify-center">
          <MotivateButton
            artist={{
              id: artist.id,
              display_name: artist.display_name,
              slug: artist.slug,
              avatar_url: artist.avatar_url,
              mobile_money_number: artist.mobile_money_number,
              mobile_money_network: artist.mobile_money_network,
            }}
            onMotivated={bumpMotivation}
          />
        </div>
        {!artist.mobile_money_number && (
          <p className="text-[11px] text-muted-foreground mt-3">
            This artist hasn't enabled mobile money yet.
          </p>
        )}
      </section>
    </AppShell>
  );
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated hairline text-[11px]">
      <span className="text-primary-glow">{icon}</span>
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function LiveTrackStreams({ track }: { track: TrackRow }) {
  const liveStreams = useLiveStreamCount(track.id, track.plays_count);
  return (
    <span className="inline-flex items-center gap-1">
      <Headphones className="w-2.5 h-2.5" />
      {fmtCount(liveStreams)}
    </span>
  );
}

function sevenDayWindowStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() - 6);
  return today;
}

function countDailyPlays(rows: Array<{ played_at: string }>, start: Date) {
  const counts = Array.from({ length: 7 }, () => 0);
  const startTime = start.getTime();
  for (const row of rows) {
    const playedAt = new Date(row.played_at);
    playedAt.setHours(0, 0, 0, 0);
    const index = Math.floor((playedAt.getTime() - startTime) / 86_400_000);
    if (index >= 0 && index < 7) counts[index] += 1;
  }
  return counts;
}

function qualifiesForBestFan(dailyPlays: number[]) {
  return dailyPlays.length === 7 && dailyPlays.every((count) => count >= 20);
}

function prettyTool(t: string) {
  const map: Record<string, string> = { suno: "Suno", udio: "Udio", stable_audio: "Stable Audio", custom_model: "Custom Model", other: "Other" };
  return map[t] ?? t;
}

const SOCIAL_FIELDS = [
  { key: "instagram_url", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/yourhandle" },
  { key: "twitter_url", label: "Twitter / X", icon: Twitter, placeholder: "https://x.com/yourhandle" },
  { key: "youtube_url", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@yourchannel" },
  { key: "tiktok_url", label: "TikTok", icon: Music2Icon, placeholder: "https://tiktok.com/@yourhandle" },
  { key: "facebook_url", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourpage" },
] as const;

// TikTok icon fallback (lucide doesn't have one)
function Music2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.6 6.3a5.3 5.3 0 0 1-3.4-1.2V15a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v2.8a2.6 2.6 0 1 0 1.8 2.5V2h2.7a5.3 5.3 0 0 0 3.4 4.3z" />
    </svg>
  );
}

interface AboutProps {
  artist: Artist;
  isOwner: boolean;
  onUpdate: (patch: Partial<Artist>) => void;
}

function ArtistAboutSection({ artist, isOwner, onUpdate }: AboutProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState(artist.bio ?? "");
  const [contactEmail, setContactEmail] = useState(artist.contact_email ?? "");
  const [momoNumber, setMomoNumber] = useState(artist.mobile_money_number ?? "");
  const [momoNetwork, setMomoNetwork] = useState(artist.mobile_money_network ?? "");
  const [socials, setSocials] = useState({
    instagram_url: artist.instagram_url ?? "",
    twitter_url: artist.twitter_url ?? "",
    youtube_url: artist.youtube_url ?? "",
    tiktok_url: artist.tiktok_url ?? "",
    facebook_url: artist.facebook_url ?? "",
  });

  function startEdit() {
    setBio(artist.bio ?? "");
    setContactEmail(artist.contact_email ?? "");
    setMomoNumber(artist.mobile_money_number ?? "");
    setMomoNetwork(artist.mobile_money_network ?? "");
    setSocials({
      instagram_url: artist.instagram_url ?? "",
      twitter_url: artist.twitter_url ?? "",
      youtube_url: artist.youtube_url ?? "",
      tiktok_url: artist.tiktok_url ?? "",
      facebook_url: artist.facebook_url ?? "",
    });
    setEditing(true);
  }

  async function save() {
    if (bio.length > 500) { toast.error("Bio must be 500 characters or less"); return; }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast.error("Enter a valid contact email"); return;
    }
    const trimmedNumber = momoNumber.trim();
    if (trimmedNumber && !momoNetwork) {
      toast.error("Pick a mobile money network"); return;
    }
    if (trimmedNumber && !/^[+\d\s-]{7,20}$/.test(trimmedNumber)) {
      toast.error("Enter a valid mobile money number"); return;
    }
    setSaving(true);
    const payload = {
      bio: bio.trim() || null,
      contact_email: contactEmail.trim() || null,
      mobile_money_number: trimmedNumber || null,
      mobile_money_network: trimmedNumber ? momoNetwork : null,
      ...Object.fromEntries(Object.entries(socials).map(([k, v]) => [k, v.trim() || null])),
    };
    const { error } = await supabase.from("artists").update(payload).eq("id", artist.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onUpdate(payload as Partial<Artist>);
    setEditing(false);
    toast.success("Profile updated");
  }

  const hasSocials = SOCIAL_FIELDS.some((f) => artist[f.key]);
  const hasAnyContent = artist.bio || artist.contact_email || hasSocials;

  if (!editing) {
    return (
      <section className="bg-surface hairline rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold">About</h2>
          {isOwner && (
            <button onClick={startEdit} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
        {!hasAnyContent ? (
          <p className="text-sm text-muted-foreground">
            {isOwner ? "Add a bio, contact email, and social links so fans can find you." : "No bio yet."}
          </p>
        ) : (
          <>
            {artist.bio && <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-w-2xl">{artist.bio}</p>}
            {(hasSocials || artist.contact_email) && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {SOCIAL_FIELDS.map(({ key, label, icon: Icon }) =>
                  artist[key] ? (
                    <a
                      key={key}
                      href={artist[key] as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={label}
                      className="w-9 h-9 rounded-full bg-surface-elevated hairline flex items-center justify-center text-muted-foreground hover:text-primary-glow hover:border-primary/40 transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  ) : null,
                )}
                {artist.contact_email && (
                  <a
                    href={`mailto:${artist.contact_email}`}
                    title={artist.contact_email}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-surface-elevated hairline text-xs text-muted-foreground hover:text-primary-glow hover:border-primary/40 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" /> Contact
                  </a>
                )}
              </div>
            )}
          </>
        )}
        {isOwner && artist.mobile_money_number && (
          <p className="text-[11px] text-muted-foreground mt-3">
            🎁 Motivation enabled · {networkLabel(artist.mobile_money_network)} · {artist.mobile_money_number}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="bg-surface hairline rounded-xl p-5 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Edit profile</h2>
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} disabled={saving} className="text-xs px-3 py-1.5 rounded-full hairline inline-flex items-center gap-1">
            <X className="w-3 h-3" /> Cancel
          </button>
          <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded-full bg-gradient-primary text-primary-foreground inline-flex items-center gap-1 shadow-glow-soft">
            <Check className="w-3 h-3" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Bio <span className="text-[10px]">({bio.length}/500)</span></label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 500))} rows={4} placeholder="Tell fans about your sound, story, or process…" />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Contact email</label>
        <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@example.com" />
      </div>

      <div className="rounded-lg hairline p-3 bg-surface-elevated/40 space-y-3">
        <div>
          <div className="text-xs font-medium inline-flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-primary-glow" /> Motivation Number
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Optional — let fans send you mobile money directly. SHY never touches the funds.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Network</label>
            <select
              value={momoNetwork}
              onChange={(e) => setMomoNetwork(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Select network</option>
              <option value="mtn">MTN Money</option>
              <option value="airtel">Airtel Money</option>
              <option value="zamtel">Zamtel Kwacha</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mobile money number</label>
            <Input
              type="tel"
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
              placeholder="0976 123 456"
            />
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {SOCIAL_FIELDS.map(({ key, label, icon: Icon, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</label>
            <Input
              value={socials[key]}
              onChange={(e) => setSocials({ ...socials, [key]: e.target.value })}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function AlbumCoverEditor({ album, userId, onUpdated }: { album: { id: string; title: string }; userId: string; onUpdated: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function handle(file: File) {
    setBusy(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/album-${album.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("covers").upload(path, file, { upsert: true });
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }
    const url = supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("albums").update({ cover_url: url }).eq("id", album.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    onUpdated(url);
    toast.success("Album cover updated");
  }
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        disabled={busy}
        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 hairline text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
        title="Change album cover"
      >
        <Camera className="w-3.5 h-3.5" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
      />
    </>
  );
}
