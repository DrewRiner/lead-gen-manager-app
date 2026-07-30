import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { OPERATOR_GUIDES } from "@/lib/guides/operator-guides";

// The Guides INDEX. Unlike an individual guide (which owns the whole canvas and
// keeps the warm paper background), the index lives inside the app's white
// chrome — so it uses the standard app theme and PageHeader, matching
// Properties / Leads / Reports. The typographic character of the guide system is
// preserved where it belongs: Instrument Serif runbook titles and large serif
// numerals. Dividers, muted text, and the arrow accent use the app tokens so
// they read on white, not on tan.
const SERIF = {
  fontFamily: "var(--font-instrument-serif), Georgia, 'Times New Roman', serif",
};

export function OperatorGuidesIndex() {
  return (
    <div>
      <PageHeader
        title="Guides"
        description="Internal runbooks for operating the business — one procedure each, start to finish."
      />

      <div className="divide-y rounded-lg border">
        {OPERATOR_GUIDES.map((g, i) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="group flex items-center gap-5 px-5 py-5 transition-colors hover:bg-muted/40"
          >
            <span
              className="w-9 shrink-0 text-center text-3xl leading-none text-muted-foreground/60"
              style={SERIF}
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-xl leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary"
                style={SERIF}
              >
                {g.title}
              </span>
              <span className="mt-1 block max-w-prose text-sm text-muted-foreground">
                {g.description}
              </span>
            </span>
            <ArrowRight
              className="hidden h-5 w-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary sm:block"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
