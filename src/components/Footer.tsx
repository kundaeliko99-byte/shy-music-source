import { Link } from "@tanstack/react-router";
import { ShyLogo } from "./ShyLogo";
import { withBasePath } from "@/lib/assets";

export function Footer() {
  const year = new Date().getFullYear();
  const legalLinks = [
    { href: "/legal", label: "Legal" },
    { href: "/safety-privacy", label: "Safety & Privacy Center" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/cookies", label: "Cookies" },
    { href: "/about-ads", label: "About Ads" },
    { href: "/accessibility", label: "Accessibility" },
  ];

  return (
    <footer className="hairline-t bg-black mt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShyLogo size={22} />
            <span className="text-xs text-zinc-300">Songwriter marketplace and creative platform.</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400" aria-label="Footer navigation">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/artists" className="hover:text-white">Artists</Link>
            <Link to="/discover" search={{ q: "", vibes: [], genres: [], mood: "", ai_tool: "" }} className="hover:text-white">Discover</Link>
            <a href={withBasePath("/#watch-out")} className="hover:text-white">Watch Out</a>
            <a href="mailto:support@shymusic.app" className="hover:text-white">Contact Support</a>
          </nav>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-zinc-400" aria-label="Legal links">
            {legalLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                {link.label}
              </a>
            ))}
          </nav>
          <p className="text-[11px] text-zinc-500">
            SHY - Songwriter marketplace. All rights reserved {year}.
          </p>
        </div>
      </div>
    </footer>
  );
}
