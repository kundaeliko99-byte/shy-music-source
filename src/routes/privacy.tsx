import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/PolicyPage";
import { policies } from "@/lib/policyContent";

export const Route = createFileRoute("/privacy")({
  head: () => policyHead(policies.privacy),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <PolicyPage policy={policies.privacy} />;
}
