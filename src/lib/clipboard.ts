export async function copyText(text: string, timeoutMs = 2500) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard unavailable");
  }

  await Promise.race([
    navigator.clipboard.writeText(text),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("Clipboard timed out")), timeoutMs);
    }),
  ]);
}
