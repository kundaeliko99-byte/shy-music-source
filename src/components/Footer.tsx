import { Link } from "@tanstack/react-router";
import { ShyLogo } from "./ShyLogo";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="hairline-t bg-surface/40 mt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShyLogo size={22} />
            <span className="text-xs text-muted-foreground">Songwriter marketplace and creative platform.</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/discover" search={{ q: "", genre: "", mood: "", ai_tool: "" }} className="hover:text-foreground">Discover</Link>
            <Link to="/charts" className="hover:text-foreground">Charts</Link>
            <Link to="/library" className="hover:text-foreground">Library</Link>
            <a href="mailto:support@shymusic.app" className="hover:text-foreground">Contact Support</a>
            <Link to="/become-artist" className="hover:text-foreground">Artist Sign Up</Link>
          </nav>
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          SHY - Songwriter marketplace. All rights reserved {year}.
        </p>
      </div>
    </footer>
  );
}
