import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/PolicyPage";
import { policies } from "@/lib/policyContent";

export const Route = createFileRoute("/accessibility")({
  head: () => policyHead(policies.accessibility),
  component: AccessibilityPage,
});

function AccessibilityPage() {
  return <PolicyPage policy={policies.accessibility} />;
}
