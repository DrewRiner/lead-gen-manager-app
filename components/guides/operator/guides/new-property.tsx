"use client";

import {
  Body,
  Checklist,
  Closing,
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

const SLUG = "set-up-a-new-property-to-collect-leads";
const meta = getOperatorGuide(SLUG)!;

const WHY =
  "A new site is ranked and ready, but until it's wired up its leads go nowhere — or land in the dashboard unattributed. Getting the hidden fields right is what makes every lead route to the correct property automatically. The honeypot field is also what keeps bot spam out.";
const BEFORE = [
  "The property's exact name as shown in the dashboard routing table",
  "Access to Engine Evolve",
  "The property's website to embed the form on",
];
const STEPS: { title: string; body: string; warn?: string }[] = [
  {
    title: "Copy the Lead Source from the routing table",
    body: "In the dashboard, open Settings → Webhooks → Routing table, find this property, and copy its exact Lead Source value with the copy button.",
  },
  {
    title: "Build the form's visible fields",
    body: "Log in to Engine Evolve at https://app.enginevolve.com and open Sites → Forms → Builder → + Add Form. Add the visible fields a visitor fills in: first name, last name, email, phone, and a message field.",
  },
  {
    title: "Add the lead_source hidden field",
    body: "Add a hidden field with the Query Key lead_source, and set its default value to the exact name you copied in step 1. This is what routes the lead to this property.",
    warn: "default value = the property's exact Lead Source from the routing table",
  },
  {
    title: "Add the website honeypot field",
    body: "Add one more hidden field with the Query Key website, and leave its default value empty. This is the honeypot — a real person never fills it, so anything that arrives with it filled is auto-flagged as spam.",
  },
  {
    title: "Publish and embed",
    body: "Publish the form and embed it on the property's website.",
  },
];
const VERIFY =
  "In the dashboard, the property should now show a green connection dot next to its name. Submit a test lead through the form and confirm it appears on that property's page in Leads within a few seconds. If it lands in the unmatched queue instead, re-check the Lead Source value against the routing table.";
const VERIFY_WARN =
  "In the unmatched queue instead? Compare the raw Lead Source it sent against the routing table.";
const BADGES: { label: string; variant: "dashboard" | "ee" | "twilio" | "critical" }[] = [
  { label: "Dashboard", variant: "dashboard" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Exact match", variant: "critical" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Engine Evolve", variant: "ee" },
];

export function NewPropertyDesigned({ initialDone }: { initialDone: string[] }) {
  return (
    <GuideProgress slug={SLUG} stepKeys={meta.stepKeys} initialDone={initialDone}>
      <GuideHeader
        eyebrow="Internal runbook / Properties"
        title="Set up a new lead gen property to collect leads"
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
          <Panel header="Two hidden fields do all the work">
            <strong>lead_source</strong> routes the lead to this property;{" "}
            <strong>website</strong> is the spam honeypot. Get these two right and
            everything else follows.
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
              <FieldMatters label="Hidden field · Query key = lead_source" caret>
                Sumter Roofing Company
              </FieldMatters>
            </StepVisual>
          ) : null}
          {i === 3 ? (
            <StepVisual>
              <FieldMatters label="Hidden field · Query key = website">(empty)</FieldMatters>
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
            <Success>The property shows a <strong>green connection dot</strong>; the test lead lands on its page.</Success>
            <Warning>{VERIFY_WARN}</Warning>
            <Closing>Green dot, lead on the property.</Closing>
          </Stack>
        }
      />
    </GuideProgress>
  );
}

export function NewPropertyPlain() {
  return (
    <PlainGuide
      eyebrow="Internal runbook / Properties"
      title="Set up a new lead gen property to collect leads"
      why={WHY}
      before={BEFORE}
      steps={STEPS}
      verify={`${VERIFY} (Note: ${VERIFY_WARN})`}
    />
  );
}
