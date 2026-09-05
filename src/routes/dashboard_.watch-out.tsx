import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { DashboardFrame, StaticWatchOutPanel } from "./dashboard";

export const Route = createFileRoute("/dashboard_/watch-out")({
  head: () => ({
    meta: [
      { title: "Watch Out - SHY" },
      { name: "description", content: "Important alerts and actions related to your SHY music." },
    ],
  }),
  component: WatchOutPage,
});

function WatchOutPage() {
  return (
    <AppShell>
      <DashboardFrame active="watch">
        <StaticWatchOutPanel />
      </DashboardFrame>
    </AppShell>
  );
}
