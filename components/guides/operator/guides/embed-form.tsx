"use client";

import Link from "next/link";

import {
  Body,
  Checklist,
  Closing,
  GuideHeader,
  GuideProgress,
  GuideShot,
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

const SLUG = "embed-a-contact-form-on-a-website";
const meta = getOperatorGuide(SLUG)!;
const BUCKET =
  "https://uoeezocngvujqcrfjryo.supabase.co/storage/v1/object/public/guide-media/embed-guide";
const IMG01 = `${BUCKET}/01-engine-evolve-integrate-copy-embed-code.png`;
const IMG02 = `${BUCKET}/02-weebly-add-embed-code-element.png`;
const IMG03 = `${BUCKET}/03-weebly-paste-embed-code-in-block.png`;

const NOTE =
  "The screenshots show Weebly, but the flow is the same on any website builder — look for an “Embed Code” / “Custom HTML” element.";
const WHY =
  "A form only collects leads once it's actually on a live web page. Building the form in Engine Evolve isn't enough — you have to embed its code into the property's website so real visitors can fill it out. Until the embed code is on the page, the form exists but no leads can come through it.";
const BEFORE = [
  "The property's lead form already built in Engine Evolve (with the Source field and hidden honeypot set — see \"Set up a new lead gen property\").",
  "Access to the property's website builder (e.g. Weebly).",
  "Know which page the form should appear on.",
];
const STEPS: { title: string; body: string; warn?: string }[] = [
  {
    title: "Open the form and click Integrate",
    body: 'In Engine Evolve, open the property\'s lead form. Click Integrate in the top right. In the "Embed or Share Form" dialog, choose Embed Code on the left.',
  },
  {
    title: "Choose Inline layout and copy the code",
    body: 'Set Embed Layout Type to Inline (the form sits directly in the page rather than as a popup or sidebar). Leave Trigger on "Always show" and Deactivation on "Never deactivate" so the form is always visible. Click Copy embed code.',
    warn: "Use Inline for a lead-gen landing page. Popup/slide-in can be missed or dismissed, costing you leads.",
  },
  {
    title: "Add an Embed Code element to the website",
    body: 'In the website builder (Weebly shown here), drag an Embed Code element onto the page where you want the form — typically next to the main copy or below the call button. It drops in as a "Custom HTML" block.',
  },
  {
    title: "Paste the embed code",
    body: "Click Edit Custom HTML on the block and paste the embed code you copied from Engine Evolve. You'll see the <iframe src=\"...leadconnectorhq.com/widget/form/...\"> code appear. The form preview renders in the block.",
    warn: "Paste the code exactly as copied. Don't edit the iframe src or the data-form-id — those tie the form to the right property's routing.",
  },
  {
    title: "Publish the website",
    body: "Click Publish in the website builder. The form is now live on the page and will start collecting leads.",
  },
];
const VERIFY =
  "Visit the live published page, fill out the form yourself as a test, and submit. Confirm the test lead lands on that property's page in the dashboard (not in Unmatched). If it lands correctly, the form is fully embedded and live.";
const BADGES: { label: string; variant: "dashboard" | "ee" | "twilio" | "critical" }[] = [
  { label: "Engine Evolve", variant: "ee" },
  { label: "Engine Evolve", variant: "ee" },
  { label: "Website", variant: "dashboard" },
  { label: "Exact paste", variant: "critical" },
  { label: "Website", variant: "dashboard" },
];
const SHOTS: (
  | { src: string; alt: string; caption: string }
  | null
)[] = [
  { src: IMG01, alt: "Engine Evolve Integrate dialog with Embed Code selected", caption: "Engine Evolve — Integrate → Embed Code (Inline), then Copy embed code" },
  null, // step 2 acts in the same dialog shown above
  { src: IMG02, alt: "Weebly editor dragging in an Embed Code element", caption: "Weebly — drag in an Embed Code element (shown in Weebly; same on any builder)" },
  { src: IMG03, alt: "Weebly Custom HTML block with the embed code pasted", caption: "Weebly — paste the embed code into the Custom HTML block" },
  null,
];

export function EmbedFormDesigned({ initialDone }: { initialDone: string[] }) {
  return (
    <GuideProgress slug={SLUG} stepKeys={meta.stepKeys} initialDone={initialDone}>
      <GuideHeader
        eyebrow="Internal runbook / Integrations"
        title="Embed a contact form on a website"
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
          <Panel header="Any website builder">
            <div className="og-panel-body" style={{ fontSize: 14, lineHeight: 1.6, color: "#2a2823" }}>
              {NOTE}
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
        right={
          <Checklist
            items={[
              <>
                The property&rsquo;s lead form already built in Engine Evolve (with
                the Source field and hidden honeypot set — see{" "}
                <Link href="/guides/set-up-a-new-property-to-collect-leads">
                  Set up a new lead gen property
                </Link>
                ).
              </>,
              "Access to the property's website builder (e.g. Weebly).",
              "Know which page the form should appear on.",
            ]}
          />
        }
      />

      <StepsLabel />

      {STEPS.map((s, i) => {
        const shot = SHOTS[i];
        return (
          <Step
            key={i}
            n={i + 1}
            stepKey={`step-${i + 1}`}
            badge={BADGES[i]}
            title={s.title}
            last={i === STEPS.length - 1}
          >
            <Body>{s.body}</Body>
            {shot ? (
              <StepVisual>
                <GuideShot src={shot.src} alt={shot.alt} caption={shot.caption} />
              </StepVisual>
            ) : null}
            {s.warn ? (
              <StepVisual>
                <Warning>{s.warn}</Warning>
              </StepVisual>
            ) : null}
          </Step>
        );
      })}

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
            <Success>Your test submission lands on the property&rsquo;s page — not in Unmatched.</Success>
            <Closing>If it lands correctly, the form is fully embedded and live.</Closing>
          </div>
        }
      />
    </GuideProgress>
  );
}

export function EmbedFormPlain() {
  return (
    <PlainGuide
      eyebrow="Internal runbook / Integrations"
      title="Embed a contact form on a website"
      note={NOTE}
      why={WHY}
      before={BEFORE}
      steps={STEPS}
      verify={VERIFY}
    />
  );
}
