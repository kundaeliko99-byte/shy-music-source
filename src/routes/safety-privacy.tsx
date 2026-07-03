import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/PolicyPage";
import { policies } from "@/lib/policyContent";

export const Route = createFileRoute("/safety-privacy")({
  head: () => policyHead(policies.safetyPrivacy),
  component: SafetyPrivacyPage,
});

function SafetyPrivacyPage() {
  return <PolicyPage policy={policies.safetyPrivacy} />;
}
