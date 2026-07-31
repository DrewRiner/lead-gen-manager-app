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
  Stack,
  Step,
  StepVisual,
  StepsLabel,
  Success,
  Warning,
} from "@/components/guides/app/ui";
import { getOperatorGuide } from "@/lib/guides/operator-guides";

const SLUG = "connect-twilio-call-tracking";
const meta = getOperatorGuide(SLUG)!;
const TW_URL = "https://lead-gen-manager-app.vercel.app/api/webhooks/twilio";

const WHY =
  "This serves the same purpose as CallRail, for numbers running on Twilio — including numbers managed through WizCaller, since those are Twilio numbers underneath. Once set up, Twilio calls route to the right property in the dashboard automatically, matched by the dialed number.";
const BEFORE = [
  "The property's Twilio number",
  "Access to the Twilio console (and to WizCaller, if the number is managed there)",
  "The Twilio Auth Token for the account (Twilio console → Account Dashboard)",
];
const STEPS: { title: string; body: string; warn?: string }[] = [
  {
    title: "Match the number to Tracking Phone",
    body: "Identify the Twilio number for the property, and set the dashboard's Tracking Phone for that property to match it exactly.",
    warn: "The dialed number is the routing key. The dashboard's Tracking Phone must match the Twilio number, or the call can't be matched to a property.",
  },
  {
    title: "Copy the Twilio endpoint URL",
    body: "In the dashboard, open Settings → Webhooks and copy the Twilio endpoint URL.",
  },
  {
    title: "Set the call status callback",
    body: "In the Twilio console, open the phone number's configuration page and set its call status callback (for completed calls, method POST) to the endpoint below.",
    warn: "If the number is managed through WizCaller, add this callback in WizCaller's Twilio config ALONGSIDE its existing one — do not replace it — so WizCaller's own routing keeps working.",
  },
  {
    title: "Set TWILIO_AUTH_TOKEN, then redeploy",
    body: "Set the Twilio Auth Token in the dashboard environment (Vercel → Project → Settings → Environment Variables) as TWILIO_AUTH_TOKEN. The dashboard uses it to verify Twilio's X-Twilio-Signature on every inbound call — this is proper request signing, so there is no secret in the URL.",
    warn: "Changing an environment variable on Vercel requires a redeploy to take effect — a common reason a freshly-set token still rejects calls.",
  },
  {
    title: "Save the number's configuration",
    body: "Save the Twilio number's configuration.",
  },
];
const VERIFY =
  "Place a test call of at least 20 seconds to the number. Within a minute, in the dashboard open Settings → Webhooks and confirm an event appears with auth valid — and that the call shows on the property's page with the red Twilio badge.";
const VERIFY_WARN =
  "Very short calls (under ~10 seconds) may not complete a status callback. Always test with a call of 20+ seconds.";

const BADGES: { label: string; variant: "dashboard" | "ee" | "twilio" | "critical" }[] = [
  { label: "Dashboard", variant: "dashboard" },
  { label: "Dashboard", variant: "dashboard" },
  { label: "Twilio", variant: "twilio" },
  { label: "Dashboard", variant: "dashboard" },
  { label: "Twilio", variant: "twilio" },
];

export function ConnectTwilioDesigned({ initialDone }: { initialDone: string[] }) {
  return (
    <GuideProgress slug={SLUG} stepKeys={meta.stepKeys} initialDone={initialDone}>
      <GuideHeader
        eyebrow="Internal runbook / Call tracking"
        title="Connect Twilio call tracking"
        pills={["5 steps", "2 systems"]}
      />

      <Section
        left={
          <>
            <H2>Why this matters</H2>
            <Body>{WHY}</Body>
          </>
        }
        right={
          <Panel header="Same idea as CallRail">
            Twilio (and WizCaller-managed Twilio numbers) post each completed
            call to the dashboard, matched by the <strong>dialed number</strong>{" "}
            → the property&rsquo;s Tracking Phone.
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
          {i === 2 ? (
            <StepVisual>
              <CodeBlock method="POST">{TW_URL}</CodeBlock>
            </StepVisual>
          ) : null}
          {i === 3 ? (
            <StepVisual>
              <FieldMatters label="Vercel env var">TWILIO_AUTH_TOKEN</FieldMatters>
            </StepVisual>
          ) : null}
          {s.warn ? (
            <StepVisual>
              <Warning>{s.warn}</Warning>
            </StepVisual>
          ) : null}
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
          <Stack>
            <Success>An event shows <strong>auth valid</strong>, and the call shows with the red Twilio badge.</Success>
            <Warning>{VERIFY_WARN}</Warning>
            <Closing>Signature valid, Twilio badge on the lead.</Closing>
          </Stack>
        }
      />
    </GuideProgress>
  );
}

export function ConnectTwilioPlain() {
  return (
    <PlainGuide
      eyebrow="Internal runbook / Call tracking"
      title="Connect Twilio call tracking"
      why={WHY}
      before={BEFORE}
      steps={STEPS}
      verify={`${VERIFY} (Note: ${VERIFY_WARN})`}
    />
  );
}
