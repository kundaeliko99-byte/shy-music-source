import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage, policyHead } from "@/components/PolicyPage";
import { policies } from "@/lib/policyContent";

export const Route = createFileRoute("/cookies")({
  head: () => policyHead(policies.cookies),
  component: CookiesPage,
});

function CookiesPage() {
  return <PolicyPage policy={policies.cookies} />;
}
