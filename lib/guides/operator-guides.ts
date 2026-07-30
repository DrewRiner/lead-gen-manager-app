// Framework-only registry (no React) for the nine designed operator guides.
// Slugs match the existing DB guide rows so the reader, index, and nav strip
// all agree. Order is the canonical guide order from the design handoff.

export interface OperatorGuideMeta {
  slug: string;
  /** Full display title (index + header H1). */
  title: string;
  /** Short label for the mono nav pills. */
  navLabel: string;
  /** Header eyebrow section, e.g. "Internal runbook / Clients". */
  eyebrow: string;
  /** One-line description for the index. */
  description: string;
  /** Ordered, stable step keys — the total drives the header counter. */
  stepKeys: string[];
  /** The troubleshooting guide uses a vermilion eyebrow. */
  alertEyebrow?: boolean;
}

const step = (n: number) => `step-${n}`;
const steps = (n: number) => Array.from({ length: n }, (_, i) => step(i + 1));

export const OPERATOR_GUIDES: OperatorGuideMeta[] = [
  {
    slug: "onboard-a-new-client-to-a-property",
    title: "Onboarding a client onto a rented property",
    navLabel: "Onboard client",
    eyebrow: "Internal runbook / Clients",
    description:
      "A new client is renting a property — get them receiving its leads today.",
    stepKeys: steps(5),
  },
  {
    slug: "switch-a-property-to-a-new-client",
    title: "Switch a property to a new client",
    navLabel: "Switch client",
    eyebrow: "Internal runbook / Clients",
    description:
      "Hand a property from an old client to a new one, cleanly and without missed leads.",
    stepKeys: steps(5),
  },
  {
    slug: "update-a-clients-phone-or-email",
    title: "Update a client's phone number or email",
    navLabel: "Update contact",
    eyebrow: "Internal runbook / Clients",
    description:
      "Change a client's contact info everywhere so they stop missing leads.",
    stepKeys: steps(5),
  },
  {
    slug: "connect-a-contact-form",
    title: "Connect a contact form (Engine Evolve)",
    navLabel: "Contact form",
    eyebrow: "Internal runbook / Integrations",
    description:
      "Wire a property's web form so its submissions route to the right property instead of Unmatched.",
    stepKeys: steps(7),
  },
  {
    slug: "connect-callrail-call-tracking",
    title: "Connect CallRail call tracking",
    navLabel: "CallRail",
    eyebrow: "Internal runbook / Integrations",
    description:
      "Route a property's tracking-number calls into the dashboard automatically — with the exact gotchas.",
    stepKeys: steps(7),
  },
  {
    slug: "connect-twilio-call-tracking",
    title: "Connect Twilio call tracking",
    navLabel: "Twilio",
    eyebrow: "Internal runbook / Integrations",
    description:
      "Route calls for numbers running on Twilio (including WizCaller-managed numbers) into the dashboard.",
    stepKeys: steps(5),
  },
  {
    slug: "change-how-a-client-gets-notified",
    title: "Change how or where a client gets notified",
    navLabel: "Notifications",
    eyebrow: "Internal runbook / Properties",
    description:
      "Switch a client between text/email or add another recipient for a property's leads.",
    stepKeys: steps(5),
  },
  {
    slug: "set-up-a-new-property-to-collect-leads",
    title: "Set up a new lead gen property to collect leads",
    navLabel: "New property",
    eyebrow: "Internal runbook / Properties",
    description:
      "Wire a newly-ranked site so its leads flow into the dashboard, attributed correctly.",
    stepKeys: steps(5),
  },
  {
    slug: "client-not-getting-leads-what-to-check",
    title: "A client says they're not getting leads — what to check",
    navLabel: "No leads",
    eyebrow: "Internal runbook / Troubleshooting",
    description:
      "Work through the likely causes in order when a client reports no leads.",
    stepKeys: steps(5),
    alertEyebrow: true,
  },
];

const BY_SLUG = new Map(OPERATOR_GUIDES.map((g) => [g.slug, g]));

export function getOperatorGuide(slug: string): OperatorGuideMeta | undefined {
  return BY_SLUG.get(slug);
}

export function isOperatorGuide(slug: string): boolean {
  return BY_SLUG.has(slug);
}
