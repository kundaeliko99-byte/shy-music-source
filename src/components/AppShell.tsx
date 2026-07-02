import type { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { MiniPlayer } from "./MiniPlayer";
import { Footer } from "./Footer";
import { usePlayer } from "@/contexts/PlayerContext";

export function AppShell({ children }: { children: ReactNode }) {
  const { current } = usePlayer();
  // Add bottom padding so mini-player doesn't cover content
  const pb = current ? "pb-32 sm:pb-24" : "pb-8";
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />
      <main className={`flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 ${pb}`}>{children}</main>
      <Footer />
      <MiniPlayer />
    </div>
  );
}
