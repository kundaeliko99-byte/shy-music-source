import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { Toaster } from "@/components/ui/sonner";
import { withBasePath } from "@/lib/assets";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-aurora px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground text-glow">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Lost in the noise</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That page does not exist on SHYMusic Creative. Try heading back home.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-gradient-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-glow-soft hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SHYMusic Creative" },
      { name: "description", content: "SHYMusic Creative is a marketplace and creative platform for songwriters, song discovery, rights management, fan support, and music buyer opportunities." },
      { name: "author", content: "SHYMusic Creative" },
      { name: "theme-color", content: "#0A0A0F" },
      { name: "application-name", content: "SHYMusic Creative" },
      { name: "apple-mobile-web-app-title", content: "SHYMusic Creative" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:title", content: "SHYMusic Creative" },
      { property: "og:description", content: "SHYMusic Creative is a marketplace and creative platform for songwriters, song discovery, rights management, fan support, and music buyer opportunities." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: withBasePath("/assets/brand/shy-logo.png") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SHYMusic Creative" },
      { name: "twitter:description", content: "SHYMusic Creative is a marketplace and creative platform for songwriters, song discovery, rights management, fan support, and music buyer opportunities." },
      { name: "twitter:image", content: withBasePath("/assets/brand/shy-logo.png") },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
      },
      { rel: "icon", type: "image/png", sizes: "16x16", href: withBasePath("/assets/brand/icon-16.png") },
      { rel: "icon", type: "image/png", sizes: "32x32", href: withBasePath("/assets/brand/icon-32.png") },
      { rel: "icon", type: "image/png", sizes: "48x48", href: withBasePath("/assets/brand/icon-48.png") },
      { rel: "apple-touch-icon", sizes: "180x180", href: withBasePath("/assets/brand/icon-180.png") },
      { rel: "manifest", href: withBasePath("/manifest.webmanifest") },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isAuthRoute =
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname.endsWith("/auth") ||
    pathname.includes("/auth/");

  if (isAuthRoute) {
    return (
      <>
        <Outlet />
        <Toaster />
      </>
    );
  }

  return (
    <AuthProvider>
      <PlayerProvider>
        <Outlet />
        <Toaster />
      </PlayerProvider>
    </AuthProvider>
  );
}
