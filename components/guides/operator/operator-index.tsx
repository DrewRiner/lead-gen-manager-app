import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import {
  VISIBLE_OPERATOR_GUIDES,
  type OperatorGuideMeta,
} from "@/lib/guides/operator-guides";

// The Guides index — main-app styling (Tailwind/shadcn tokens, same as
// Dashboard/Leads), NOT the retired warm-paper design system. Guides are
// grouped by category; hidden guides (e.g. Twilio until it's live) are excluded.

// Category is the last segment of the eyebrow ("Internal runbook / Clients").
function categoryOf(g: OperatorGuideMeta): string {
  const parts = g.eyebrow.split("/");
  return (parts[parts.length - 1] ?? "Guides").trim();
}

// Fixed display order for the category sections.
const CATEGORY_ORDER = ["Clients", "Integrations", "Properties", "Troubleshooting"];

export function OperatorGuidesIndex() {
  const groups = new Map<string, OperatorGuideMeta[]>();
  for (const g of VISIBLE_OPERATOR_GUIDES) {
    const cat = categoryOf(g);
    (groups.get(cat) ?? groups.set(cat, []).get(cat)!).push(g);
  }
  const orderedCats = [
    ...CATEGORY_ORDER.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  return (
    <div>
      <PageHeader
        title="Guides"
        description="Internal runbooks for operating the business — one procedure each, with the exact gotchas and how to verify it worked."
      />

      <div className="space-y-8">
        {orderedCats.map((cat) => (
          <section key={cat}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {cat}
            </h2>
            <div className="divide-y rounded-lg border">
              {groups.get(cat)!.map((g) => (
                <Link
                  key={g.slug}
                  href={`/guides/${g.slug}`}
                  className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium tracking-tight transition-colors group-hover:text-primary">
                      {g.title}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {g.description}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
