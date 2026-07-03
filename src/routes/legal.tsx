import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/PolicyPage";
import { policies } from "@/lib/policyContent";

export const Route = createFileRoute("/legal")({
  head: () => policyHead(policies.legal),
  component: LegalPage,
});

function LegalPage() {
  return <PolicyPage policy={policies.legal} />;
}
