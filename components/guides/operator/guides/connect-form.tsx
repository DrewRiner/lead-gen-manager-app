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

const SLUG = "connect-a-contact-form";
const meta = getOperatorGuide(SLUG)!;
const GHL_URL = "https://lead-gen-manager-app.vercel.app/api/webhooks/ghl-form";

const WHY =
  "Contact forms are how web leads reach the dashboard. Everything hinges on one field: the form's Source must match the property's Lead Source in the dashboard character-for-character. Get it wrong and every submission lands in the Unmatched queue instead of on the property — the client is paying and hearing nothing.";
const BEFORE = [
  "The property's exact name as it appears in the dashboard's Lead Source setting (Settings → Webhooks routing table)",
  "The X-Webhook-Secret value from the dashboard's Settings → Webhooks",
  "Access to Engine Evolve at https://app.enginevolve.com",
];
const STEPS: { title: string; body: string; warn?: string }[] = [
  {
    title: "Open the property's lead form",
    body: "In Engine Evolve, go to Sites → Forms and open (or create) this property's lead form.",
  },
  {
    title: "Add the visible fields",
    body: "Add the required fields — name, phone, email — plus any qualifying fields you want the client to see (service needed, address, notes, etc.).",
  },
  {
    title: "Set the Source field",
    body: "Set the form's Source field to exactly the property's name as it appears in the dashboard's Lead Source setting.",
    warn: "The Source must match the dashboard's Lead Source character-for-character (spacing, punctuation, capitalization). If it doesn't, the lead lands in Unmatched instead of routing to the property.",
  },
  {
    title: "Add the hidden spam honeypot",
    body: "Add a hidden field with the Query Key website, marked Hidden, with its value left empty. This is the spam honeypot — real visitors never see it and leave it blank, while bots fill it in and get auto-flagged as spam.",
  },
  {
    title: "Build the delivery workflow",
    body: "Build the delivery workflow: go to Automation → Workflows, add a trigger Form Submitted filtered to this form, then add a Webhook action (method POST) to the endpoint below. Add a header X-Webhook-Secret set to the value from the dashboard's Settings → Webhooks.",
    warn: "The X-Webhook-Secret header value must match the dashboard's webhook secret exactly, or the submission is rejected before it ever reaches the property.",
  },
  {
    title: "Add the client notification actions",
    body: "Add the client notification actions (Send Email / Send SMS) as needed so the client is alerted on each new lead.",
  },
  {
    title: "Publish the workflow",
    body: "Publish the workflow so it goes live.",
  },
];
const VERIFY =
  "Submit a test entry through the form. Within a few seconds it should appear on that property's page in the dashboard — not in the Unmatched queue. If it lands in Unmatched, re-check the form's Source against the property's Lead Source in the routing table.";

const BADGES: { label: string; variant: "dashboard" | "ee" | "twilio" | "critical" }[] = [
  { label: "Engine Evolve", variant: "ee" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Exact match", variant: "critical" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Engine Evolve", variant: "ee" },
];

export function ConnectFormDesigned({ initialDone }: { initialDone: string[] }) {
  return (
    <GuideProgress slug={SLUG} stepKeys={meta.stepKeys} initialDone={initialDone}>
      <GuideHeader
        eyebrow="Internal runbook / Engine Evolve"
        title="Connect a contact form"
        pills={["7 steps", "2 systems"]}
      />

      <Section
        left={
          <>
            <H2>Why this matters</H2>
            <Body>{WHY}</Body>
          </>
        }
        right={
          <Panel header="One field decides everything">
            <div className="og-panel-body" style={{ fontSize: 14, lineHeight: 1.6, color: "#2a2823" }}>
              Form <strong>Source</strong> = dashboard <strong>Lead Source</strong>{" "}
              → routes to the property. Any mismatch → the{" "}
              <strong>Unmatched</strong> queue.
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
          {i === 2 ? (
            <StepVisual>
              <FieldMatters label="Form source" caret>
                Sumter Roofing Company
              </FieldMatters>
            </StepVisual>
          ) : null}
          {i === 3 ? (
            <StepVisual>
              <FieldMatters label="Hidden field · Query key">website (Hidden, empty)</FieldMatters>
            </StepVisual>
          ) : null}
          {i === 4 ? (
            <StepVisual>
              <CodeBlock method="POST">{GHL_URL}</CodeBlock>
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
          <div className="og-stack">
            <Success>Test entry appears on the property&rsquo;s page — not in Unmatched.</Success>
            <Closing>On the property, within seconds.</Closing>
          </div>
        }
      />
    </GuideProgress>
  );
}

export function ConnectFormPlain() {
  return (
    <PlainGuide
      eyebrow="Internal runbook / Engine Evolve"
      title="Connect a contact form"
      why={WHY}
      before={BEFORE}
      steps={STEPS}
      verify={VERIFY}
    />
  );
}
