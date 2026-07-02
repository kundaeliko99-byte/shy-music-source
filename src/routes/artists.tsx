import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/artists")({
  component: ArtistsLayout,
});

function ArtistsLayout() {
  return <Outlet />;
}
