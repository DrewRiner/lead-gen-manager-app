"use client";

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
  StatusPill,
  Step,
  StepVisual,
  StepsLabel,
  Success,
} from "@/components/guides/operator/primitives";
import { getOperatorGuide } from "@/lib/guides/operator-guides";

const SLUG = "change-how-a-client-gets-notified";
const meta = getOperatorGuide(SLUG)!;

const WHY =
  "A client wants their lead alerts a different way — text instead of email, or a second person added. Getting this right is what keeps them responding to leads fast. Set it up wrong and they either miss alerts or get double-notified and tune them out.";
const BEFORE = [
  "Exactly what they want (which method — text or email — and who should receive alerts)",
  "Which property this is for",
];
const STEPS: { title: string; body: string }[] = [
  {
    title: "Open this property's workflow",
    body: "Log in to Engine Evolve at https://app.enginevolve.com, open Automation → Workflows, and open this property's workflow.",
  },
  {
    title: "Change the method",
    body: "To change the method: enable/add a Send SMS action for text, or a Send Email action for email, and remove the action for the method they no longer want.",
  },
  {
    title: "Add a person",
    body: "To add a person: add their email or phone number to the relevant notification action(s) alongside the existing recipient.",
  },
  {
    title: "Confirm every contact detail",
    body: "Confirm every contact detail is correct and current before saving — a typo here means a missed lead.",
  },
  {
    title: "Save and publish",
    body: "Save and publish the workflow.",
  },
];
const VERIFY =
  "Send a test lead for this property and confirm the notification arrives by the right method and reaches everyone who should get it — and no one who shouldn't.";
const BADGES: { label: string; variant: "dashboard" | "ee" | "twilio" | "critical" }[] = [
  { label: "Engine Evolve", variant: "ee" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Double-check", variant: "critical" },
  { label: "Engine Evolve", variant: "ee" },
];

export function ChangeNotificationDesigned({ initialDone }: { initialDone: string[] }) {
  return (
    <GuideProgress slug={SLUG} stepKeys={meta.stepKeys} initialDone={initialDone}>
      <GuideHeader
        eyebrow="Internal runbook / Properties"
        title="Change how or where a client gets notified"
        pills={["5 steps", "1 system"]}
      />

      <Section
        left={
          <>
            <H2>Why this matters</H2>
            <Body>{WHY}</Body>
          </>
        }
        right={
          <Panel header="Method & recipients">
            <div className="og-panel-body" style={{ fontSize: 14, lineHeight: 1.6, color: "#2a2823" }}>
              Every lead alert is a Send Email / Send SMS action in the
              property&rsquo;s workflow. Change the <strong>method</strong> by
              swapping the action; change <strong>who</strong> by editing the
              recipients — on every relevant action.
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
          {i === 1 ? (
            <StepVisual>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <StatusPill tone="error">✕ Email action removed</StatusPill>
                <StatusPill tone="ok">✓ SMS action added</StatusPill>
              </div>
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
            <Success>Alert arrives by the right method, to everyone who should get it — and no one else.</Success>
            <Closing>Right method, right people, no one else.</Closing>
          </div>
        }
      />
    </GuideProgress>
  );
}

export function ChangeNotificationPlain() {
  return (
    <PlainGuide
      eyebrow="Internal runbook / Properties"
      title="Change how or where a client gets notified"
      why={WHY}
      before={BEFORE}
      steps={STEPS}
      verify={VERIFY}
    />
  );
}
