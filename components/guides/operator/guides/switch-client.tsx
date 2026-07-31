"use client";

import { Bell, MessageSquare } from "lucide-react";

import {
  Body,
  Checklist,
  Closing,
  Compare,
  DiagramCard,
  GuideHeader,
  GuideProgress,
  H2,
  Node,
  NodeConnector,
  Panel,
  PlainGuide,
  Section,
  Stack,
  StatusPill,
  Step,
  StepVisual,
  StepsLabel,
  Success,
  ToggleSwitch,
  Warning,
} from "@/components/guides/app/ui";
import { getOperatorGuide } from "@/lib/guides/operator-guides";

const SLUG = "switch-a-property-to-a-new-client";
const meta = getOperatorGuide(SLUG)!;

const WHY =
  "The old client is done and a new one is taking over this property. Leads must stop going to the old client and start going to the new one, and the billing has to change hands cleanly. Get it half-right and either the old client keeps getting leads they no longer pay for, or the new client gets nothing.";
const BEFORE = [
  "Which property is changing hands",
  "The new client's name, phone, and email",
  "The date the switch takes effect and the new rate/terms",
];
const STEPS: { title: string; body: string; warn?: string }[] = [
  {
    title: "End the old assignment",
    body: "In the dashboard, open the property. End the old assignment (Unassign / end assignment) effective the correct date so the old client stops as of then. Historical revenue is preserved.",
  },
  {
    title: "Assign the new client",
    body: "Assign the new client on the same property, set their rate/terms, and save. The property should now show the new client as active.",
  },
  {
    title: "Repoint the workflow's notification actions",
    body: "Log in to Engine Evolve at https://app.enginevolve.com, open this property's workflow (Automation → Workflows), and change every Send Email / Send SMS action from the old client's email/phone to the new client's.",
  },
  {
    title: "Sweep the old client out of every action",
    body: "Double-check the old client is removed from every notification action so they stop receiving this property's leads entirely.",
    warn: "Also check Cc / Bcc fields and any second email or SMS step further down the branch. If the old client's address survives anywhere in this workflow, they keep getting leads they no longer pay for.",
  },
  {
    title: "Save action, then flip Draft to Publish",
    body: "Save and publish the workflow.",
  },
];
const VERIFY =
  "In the dashboard, the property shows the new client active and the old client's assignment ended. Submit a test lead and confirm the notification reaches the new client only — the old client should get nothing.";
const CLOSING = "New client only. Old client, nothing.";
const BADGES = [
  { label: "Dashboard", variant: "dashboard" as const },
  { label: "Dashboard", variant: "dashboard" as const },
  { label: "Engine Evolve", variant: "ee" as const },
  { label: "Double-check", variant: "critical" as const },
  { label: "Engine Evolve", variant: "ee" as const },
];

export function SwitchClientDesigned({ initialDone }: { initialDone: string[] }) {
  return (
    <GuideProgress slug={SLUG} stepKeys={meta.stepKeys} initialDone={initialDone}>
      <GuideHeader
        eyebrow="Internal runbook / Property operations"
        title="Switch a property to a new client"
        xl
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
          <Compare>
            <DiagramCard tone="bad" label="Handoff done wrong">
              Old client still on a notification action → keeps getting leads they
              no longer pay for. Or the new client is never wired in → gets nothing.
            </DiagramCard>
            <DiagramCard tone="good" label="Handoff done clean">
              Old assignment ended · new client active · every action repointed →
              leads reach the new client the moment they arrive.
            </DiagramCard>
          </Compare>
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

      <Step n={1} stepKey="step-1" badge={BADGES[0]} title={STEPS[0].title}>
        <Body>{STEPS[0].body}</Body>
        <StepVisual>
          <Panel header="Dashboard — Properties / Sumter Roofing Company" deep>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-semibold">Sumter Roofing Company</span>
              <span className="ml-auto flex flex-wrap gap-2">
                <ActionBtn>Reassign</ActionBtn>
                <ActionBtn>Change rate</ActionBtn>
                <ActionBtn danger>Unassign</ActionBtn>
              </span>
            </div>
          </Panel>
        </StepVisual>
      </Step>

      <Step n={2} stepKey="step-2" badge={BADGES[1]} title={STEPS[1].title}>
        <Body>{STEPS[1].body}</Body>
        <StepVisual>
          <Success>
            Current client is now <strong>Marios Bros Fencing</strong> · $50.00 /
            lead · Month-to-month.
          </Success>
        </StepVisual>
      </Step>

      <Step n={3} stepKey="step-3" badge={BADGES[2]} title={STEPS[2].title}>
        <Body>
          Log in to Engine Evolve at{" "}
          <a href="https://app.enginevolve.com">https://app.enginevolve.com</a>, open
          this property&rsquo;s workflow (Automation → Workflows), and change every
          Send Email / Send SMS action from the old client&rsquo;s email/phone to the
          new client&rsquo;s.
        </Body>
        <StepVisual>
          <div className="flex flex-col items-center">
            <Node
              icon={<Bell size={12} />}
              iconBg="#65a30d"
              label="Client Email Notification"
              edit
              value={<>TO CUSTOM EMAIL → new client&rsquo;s email</>}
            />
            <NodeConnector />
            <Node
              icon={<MessageSquare size={12} />}
              iconBg="#65a30d"
              label="Client SMS Notification"
              edit
              value={<>TO CUSTOM PHONE → new client&rsquo;s phone</>}
            />
          </div>
        </StepVisual>
      </Step>

      <Step n={4} stepKey="step-4" badge={BADGES[3]} title={STEPS[3].title}>
        <Body>{STEPS[3].body}</Body>
        <StepVisual>
          <Warning>{STEPS[3].warn}</Warning>
        </StepVisual>
      </Step>

      <Step n={5} stepKey="step-5" badge={BADGES[4]} title={STEPS[4].title} last>
        <Body>{STEPS[4].body}</Body>
        <StepVisual>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Draft</span>
            <ToggleSwitch />
            <span>Publish</span>
            <span aria-hidden>→</span>
            <StatusPill tone="ok">Published</StatusPill>
          </div>
        </StepVisual>
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
          <Stack>
            <Success>Property shows the new client active; old assignment ended.</Success>
            <Success>Test lead reaches the new client — old client gets nothing.</Success>
            <Closing>{CLOSING}</Closing>
          </Stack>
        }
      />
    </GuideProgress>
  );
}

export function SwitchClientPlain() {
  return (
    <PlainGuide
      eyebrow="Internal runbook / Property operations"
      title="Switch a property to a new client"
      why={WHY}
      before={BEFORE}
      steps={STEPS}
      verify={VERIFY}
    />
  );
}

function ActionBtn({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <span
      className={
        "rounded-md border px-2.5 py-1.5 text-xs font-medium " +
        (danger ? "border-destructive/50 text-destructive" : "text-muted-foreground")
      }
    >
      {children}
    </span>
  );
}
