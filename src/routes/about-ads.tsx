import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/PolicyPage";
import { policies } from "@/lib/policyContent";

export const Route = createFileRoute("/about-ads")({
  head: () => policyHead(policies.aboutAds),
  component: AboutAdsPage,
});

function AboutAdsPage() {
  return <PolicyPage policy={policies.aboutAds} />;
}
