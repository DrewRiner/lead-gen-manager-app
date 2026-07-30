"use client";

import Link from "next/link";

import {
  Body,
  Checklist,
  Closing,
  GuideHeader,
  GuideProgress,
  H2,
  Panel,
  PlainGuide,
  Section,
  Step,
  StepsLabel,
  Success,
} from "@/components/guides/operator/primitives";
import { getOperatorGuide } from "@/lib/guides/operator-guides";

const SLUG = "client-not-getting-leads-what-to-check";
const meta = getOperatorGuide(SLUG)!;
const NEW_PROPERTY = "/guides/set-up-a-new-property-to-collect-leads";
const UPDATE_CONTACT = "/guides/update-a-clients-phone-or-email";

const WHY =
  "This is urgent. A paying client who thinks they're getting nothing churns fast — often before they even tell us twice. Work through the causes below in order, from most common to least, so you find the real problem quickly instead of guessing.";
const BEFORE = [
  "Which client and property they're asking about",
  "Roughly when they last received a lead",
];
const VERIFY =
  "Note which step turned out to be the problem, fix it, then submit a test lead and confirm it both lands on the property in the dashboard and reaches the client's notification. Then let the client know it's resolved.";

// Plain-text bodies (verbatim; cross-guide links rendered as plain text here,
// as real links in the designed tab below).
const PLAIN_STEPS = [
  {
    title: "Is the property connected?",
    body: "In the dashboard, open the property and check the connection dot next to its name. If it's red, no Lead Source is set and nothing can route — follow Set up a new lead gen property to collect leads to fix it.",
  },
  {
    title: "Are leads actually coming in?",
    body: "On the property page, look at recent Leads. If leads are arriving in the dashboard but the client isn't hearing about them, it's a notification problem (steps 3–4). If no leads are arriving at all, it's an upstream form/traffic problem, not delivery.",
  },
  {
    title: "Is the form still live?",
    body: "In Engine Evolve (https://app.enginevolve.com), open the property's form and confirm it's still Published — not unpublished or reverted to draft. An unpublished form silently collects nothing.",
  },
  {
    title: "Are notifications pointing at the right person?",
    body: "In Engine Evolve, open the property's workflow and confirm the Send Email / Send SMS actions use the client's current email and phone — not an old one. If the info is stale, follow Update a client's phone number or email.",
  },
  {
    title: "Are leads arriving but not routing?",
    body: "In the dashboard, check the unmatched leads queue (Leads → filter Unmatched, or Settings → Webhooks → Recent unmatched leads). If the client's leads are landing there, the form's Lead Source value doesn't match — fix it per Set up a new lead gen property to collect leads.",
  },
];
const BADGES: { label: string; variant: "dashboard" | "ee" | "twilio" | "critical" }[] = [
  { label: "Dashboard", variant: "dashboard" },
  { label: "Dashboard", variant: "dashboard" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Dashboard", variant: "dashboard" },
];

export function NoLeadsDesigned({ initialDone }: { initialDone: string[] }) {
  return (
    <GuideProgress slug={SLUG} stepKeys={meta.stepKeys} initialDone={initialDone}>
      <GuideHeader
        eyebrow="Internal runbook / Troubleshooting · urgent"
        alertEyebrow
        title="A client says they're not getting leads — what to check"
        pills={["5 checks"]}
      />

      <Section
        left={
          <>
            <H2>Why this matters</H2>
            <Body>{WHY}</Body>
          </>
        }
        right={
          <Panel header="Work the causes in order">
            <div className="og-panel-body" style={{ fontSize: 14, lineHeight: 1.6, color: "#2a2823" }}>
              Connected? → Leads arriving? → Form live? → Notifications current? →
              Routing (unmatched)? Most common first, so you fix it fast.
            </div>
          </Panel>
        }
      />

      <Section
        variant="rule"
        left={
          <>
            <H2>Before you start</H2>
            <Body>Have on hand:</Body>
          </>
        }
        right={<Checklist items={BEFORE} />}
      />

      <StepsLabel />

      <Step n={1} stepKey="step-1" badge={BADGES[0]} title={PLAIN_STEPS[0].title}>
        <Body>
          In the dashboard, open the property and check the connection dot next to
          its name. If it&rsquo;s red, no Lead Source is set and nothing can route —
          follow{" "}
          <Link href={NEW_PROPERTY}>Set up a new lead gen property to collect leads</Link>{" "}
          to fix it.
        </Body>
      </Step>

      <Step n={2} stepKey="step-2" badge={BADGES[1]} title={PLAIN_STEPS[1].title}>
        <Body>{PLAIN_STEPS[1].body}</Body>
      </Step>

      <Step n={3} stepKey="step-3" badge={BADGES[2]} title={PLAIN_STEPS[2].title}>
        <Body>
          In Engine Evolve (
          <a href="https://app.enginevolve.com">https://app.enginevolve.com</a>), open
          the property&rsquo;s form and confirm it&rsquo;s still Published — not
          unpublished or reverted to draft. An unpublished form silently collects
          nothing.
        </Body>
      </Step>

      <Step n={4} stepKey="step-4" badge={BADGES[3]} title={PLAIN_STEPS[3].title}>
        <Body>
          In Engine Evolve, open the property&rsquo;s workflow and confirm the Send
          Email / Send SMS actions use the client&rsquo;s current email and phone —
          not an old one. If the info is stale, follow{" "}
          <Link href={UPDATE_CONTACT}>Update a client&rsquo;s phone number or email</Link>.
        </Body>
      </Step>

      <Step n={5} stepKey="step-5" badge={BADGES[4]} title={PLAIN_STEPS[4].title} last>
        <Body>
          In the dashboard, check the unmatched leads queue (Leads → filter
          Unmatched, or Settings → Webhooks → Recent unmatched leads). If the
          client&rsquo;s leads are landing there, the form&rsquo;s Lead Source value
          doesn&rsquo;t match — fix it per{" "}
          <Link href={NEW_PROPERTY}>Set up a new lead gen property to collect leads</Link>.
        </Body>
      </Step>

      <Section
        variant="verify"
        left={
          <>
            <H2>How to check it worked</H2>
            <Body>{VERIFY}</Body>
          </>
        }
        right={
          <div className="og-stack">
            <Success>Test lead lands on the property AND reaches the client&rsquo;s notification.</Success>
            <Closing>Fixed, tested, and the client knows.</Closing>
          </div>
        }
      />
    </GuideProgress>
  );
}

export function NoLeadsPlain() {
  return (
    <PlainGuide
      eyebrow="Internal runbook / Troubleshooting · urgent"
      title="A client says they're not getting leads — what to check"
      why={WHY}
      before={BEFORE}
      steps={PLAIN_STEPS}
      verify={VERIFY}
    />
  );
}
