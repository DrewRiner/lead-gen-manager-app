"use client";

import {
  Body,
  Checklist,
  Closing,
  CodeBlock,
  FieldMatters,
  GuideHeader,
  GuideProgress,
  H2,
  Panel,
  PlainGuide,
  Section,
  Step,
  StepVisual,
  StepsLabel,
  Success,
  Warning,
} from "@/components/guides/operator/primitives";
import { getOperatorGuide } from "@/lib/guides/operator-guides";

const SLUG = "connect-callrail-call-tracking";
const meta = getOperatorGuide(SLUG)!;
const CR_URL =
  "https://lead-gen-manager-app.vercel.app/api/webhooks/callrail?secret=YOUR_SECRET";

const WHY =
  "CallRail sends each tracked phone call to the dashboard so it routes to the right property automatically. The routing key is the dialed tracking number, so the dashboard's Tracking Phone has to match it exactly. The steps below encode the specific mistakes we've already made once — follow them in order so nobody repeats them.";
const BEFORE = [
  "The property's CallRail tracking number",
  "The CallRail webhook secret from the dashboard's Settings → Webhooks",
  "Access to the CallRail account for this property",
];
const STEPS: { title: string; body: string; warn?: string; warns?: string[] }[] = [
  {
    title: "Match the tracking number",
    body: "In CallRail → Numbers, note the property's tracking number. In the dashboard, open that property and set its Tracking Phone to the same number.",
    warn: "The dialed tracking number is the routing key. If the dashboard's Tracking Phone doesn't match the CallRail number exactly, the call can't be matched to a property.",
  },
  {
    title: "Copy the CallRail webhook secret",
    body: "In the dashboard, open Settings → Webhooks and copy the CallRail webhook secret value.",
  },
  {
    title: "Turn the Webhooks integration on",
    body: "In CallRail → Settings → Integrations → Webhooks, set the integration to ACTIVE.",
    warn: "An Inactive integration silently sends nothing — no error, no calls, no leads. Confirm it reads Active.",
  },
  {
    title: "Paste the URL into Post-Call and Call Modified",
    body: "In BOTH the Post-Call and Call Modified boxes, paste this exact URL, with the secret as a query parameter:",
    warns: [
      "CallRail on the standard plan does not send a signed header, so the secret rides in the URL. The ?secret= value must match the dashboard's CALLRAIL_WEBHOOK_SECRET exactly. Fill BOTH boxes — miss one and you only get delayed leads.",
      "Post-Call vs Call Modified: Post-Call fires at hangup (fast); Call Modified can lag up to ~20 minutes. Fill BOTH so leads arrive immediately instead of up to 20 minutes late.",
    ],
  },
  {
    title: "Remember the redeploy",
    body: "If the secret is stored as an environment variable, remember that changing it requires a redeploy to take effect. A common reason a “fixed” secret still rejects calls is that the new value hasn't been redeployed yet.",
  },
  {
    title: "Save the webhook settings",
    body: "Save the CallRail webhook settings.",
  },
];
const VERIFY =
  "Place a test call of at least 20 seconds to the tracking number. Wait a couple of minutes, then in the dashboard open Settings → Webhooks and confirm an event appears with auth_valid true — and that the call shows up on the property's page.";
const VERIFY_WARN =
  "Very short calls (under ~10 seconds) may not fire a webhook at all. Always test with a call of 20+ seconds.";

const BADGES: { label: string; variant: "dashboard" | "ee" | "twilio" | "critical" }[] = [
  { label: "Dashboard", variant: "dashboard" },
  { label: "Dashboard", variant: "dashboard" },
  { label: "CallRail", variant: "dashboard" },
  { label: "Both boxes", variant: "critical" },
  { label: "Dashboard", variant: "dashboard" },
  { label: "CallRail", variant: "dashboard" },
];

export function ConnectCallRailDesigned({ initialDone }: { initialDone: string[] }) {
  return (
    <GuideProgress slug={SLUG} stepKeys={meta.stepKeys} initialDone={initialDone}>
      <GuideHeader
        eyebrow="Internal runbook / Call tracking"
        title="Connect CallRail call tracking"
        pills={["6 steps", "2 systems"]}
      />

      <Section
        left={
          <>
            <H2>Why this matters</H2>
            <Body>{WHY}</Body>
          </>
        }
        right={
          <Panel header="The routing key">
            <div className="og-panel-body" style={{ fontSize: 14, lineHeight: 1.6, color: "#2a2823" }}>
              Dialed <strong>tracking number</strong> = the property&rsquo;s{" "}
              <strong>Tracking Phone</strong> in the dashboard. Match them exactly
              or the call can&rsquo;t be attributed.
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

      {STEPS.map((s, i) => (
        <Step
          key={i}
          n={i + 1}
          stepKey={`step-${i + 1}`}
          badge={BADGES[i]}
          title={s.title}
          last={i === STEPS.length - 1}
        >
          <Body>{s.body}</Body>
          {i === 0 ? (
            <StepVisual>
              <FieldMatters label="Tracking phone">+18033731022</FieldMatters>
            </StepVisual>
          ) : null}
          {i === 3 ? (
            <StepVisual>
              <CodeBlock>{CR_URL}</CodeBlock>
            </StepVisual>
          ) : null}
          {s.warn ? (
            <StepVisual>
              <Warning>{s.warn}</Warning>
            </StepVisual>
          ) : null}
          {(s.warns ?? []).map((w, j) => (
            <StepVisual key={j}>
              <Warning>{w}</Warning>
            </StepVisual>
          ))}
        </Step>
      ))}

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
            <Success>An event shows <strong>auth_valid true</strong>, and the call lands on the property.</Success>
            <Warning>{VERIFY_WARN}</Warning>
            <Closing>Auth valid, call on the property.</Closing>
          </div>
        }
      />
    </GuideProgress>
  );
}

export function ConnectCallRailPlain() {
  return (
    <PlainGuide
      eyebrow="Internal runbook / Call tracking"
      title="Connect CallRail call tracking"
      why={WHY}
      before={BEFORE}
      steps={STEPS}
      verify={`${VERIFY} (Note: ${VERIFY_WARN})`}
    />
  );
}
