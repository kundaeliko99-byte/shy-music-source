import { supabase } from "@/integrations/supabase/client";

const AUDIO_PUBLIC_PREFIX = "/storage/v1/object/public/audio/";
const AUDIO_SIGNED_PREFIX = "/storage/v1/object/sign/audio/";

export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
]);

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "webm"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function fileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function pathFromStorageUrl(value: string, marker: string) {
  try {
    const url = new URL(value);
    const index = url.pathname.indexOf(marker);
    if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    const index = value.indexOf(marker);
    if (index >= 0) return value.slice(index + marker.length);
  }
  return null;
}

export function getAudioStoragePath(value: string) {
  const fromPublic = pathFromStorageUrl(value, AUDIO_PUBLIC_PREFIX);
  if (fromPublic) return fromPublic;
  const fromSigned = pathFromStorageUrl(value, AUDIO_SIGNED_PREFIX);
  if (fromSigned) return fromSigned.split("?")[0];
  return value.replace(/^audio\//, "").replace(/^\/+/, "");
}

export async function resolveAudioUrl(value: string, expiresIn = 3600) {
  if (/^blob:|^data:/.test(value)) return value;
  const path = getAudioStoragePath(value);
  const { data, error } = await supabase.storage.from("audio").createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    if (/^https?:\/\//.test(value)) return value;
    throw error ?? new Error("Could not create signed audio URL");
  }
  return data.signedUrl;
}

export function assertAudioFile(file: File) {
  const ext = fileExtension(file);
  if (file.size > MAX_AUDIO_BYTES) throw new Error("Audio file must be 50MB or smaller.");
  if (!AUDIO_EXTENSIONS.has(ext)) throw new Error("Use MP3, WAV, M4A, AAC, OGG, or WebM audio.");
  if (file.type && !AUDIO_TYPES.has(file.type)) throw new Error("Unsupported audio file type.");
}

export function assertImageFile(file: File) {
  const ext = fileExtension(file);
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image file must be 8MB or smaller.");
  if (!IMAGE_EXTENSIONS.has(ext)) throw new Error("Use JPG, PNG, or WebP artwork.");
  if (file.type && !IMAGE_TYPES.has(file.type)) throw new Error("Unsupported image file type.");
}

export function safeMediaExtension(file: File, fallback: string) {
  const ext = fileExtension(file).replace(/[^a-z0-9]/g, "");
  return ext || fallback;
}
