import "./operator-guide.css";

import Link from "next/link";

import { OPERATOR_GUIDES } from "@/lib/guides/operator-guides";

// The Guides index (not designed in the handoff — built here). Reuses the
// design system: a clean numbered list of the nine runbooks with Instrument
// Serif titles and one-line descriptions.
export function OperatorGuidesIndex() {
  return (
    <div className="og">
      <div className="og-page">
        <div className="og-index-head">
          <div className="og-eyebrow">Internal runbooks / Operator guides</div>
          <h1 className="og-index-title">Guides</h1>
        </div>
        <div className="og-index-list">
          {OPERATOR_GUIDES.map((g, i) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="og-index-card">
              <span className="og-index-num">{i + 1}</span>
              <span>
                <span className="og-index-h">{g.title}</span>
                <span className="og-index-desc" style={{ display: "block" }}>
                  {g.description}
                </span>
              </span>
              <span className="og-index-arrow" aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
