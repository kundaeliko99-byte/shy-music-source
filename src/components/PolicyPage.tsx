import { ShieldCheck } from "lucide-react";
import { AppShell } from "./AppShell";
import { type PolicyPageContent, policyNav } from "@/lib/policyContent";

export function policyHead(policy: PolicyPageContent) {
  return {
    meta: [
      { title: `${policy.title} - SHY` },
      { name: "description", content: policy.description },
      { property: "og:title", content: `${policy.title} - SHY` },
      { property: "og:description", content: policy.description },
    ],
  };
}

export function PolicyPage({ policy }: { policy: PolicyPageContent }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <header className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-surface to-background p-6 hairline">
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-primary-glow hairline">
              <ShieldCheck className="h-3 w-3" />
              {policy.eyebrow}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{policy.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{policy.description}</p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="rounded-xl bg-surface p-3 text-sm hairline" aria-label="Policy navigation">
              {policyNav.map((item) => {
                const active = item.slug === policy.slug;
                return (
                  <a
                    key={item.slug}
                    href={`/${item.slug}`}
                    className={`block rounded-lg px-3 py-2 transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                    }`}
                  >
                    {item.title}
                  </a>
                );
              })}
            </nav>
          </aside>

          <article className="rounded-xl bg-surface p-5 hairline sm:p-7">
            <div className="space-y-8">
              {policy.sections.map((section) => (
                <section key={section.title} className="scroll-mt-24">
                  <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                  {section.body?.map((paragraph) => (
                    <p key={paragraph} className="mt-3 text-sm leading-7 text-muted-foreground">
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets && (
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
                      {section.bullets.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-glow" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </AppShell>
  );
}
