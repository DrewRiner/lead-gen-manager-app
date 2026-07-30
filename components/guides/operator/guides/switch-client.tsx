"use client";

import { Bell, MessageSquare } from "lucide-react";

import {
  Body,
  Checklist,
  Closing,
  DiagramCard,
  GuideHeader,
  GuideProgress,
  H2,
  Node,
  NodeConnector,
  Panel,
  PlainGuide,
  Section,
  StatusPill,
  Step,
  StepVisual,
  StepsLabel,
  Success,
  ToggleSwitch,
  Warning,
} from "@/components/guides/operator/primitives";
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
          <div className="og-diagram">
            <DiagramCard tone="bad" label="Handoff done wrong" labelColor="#93290f">
              <div style={{ fontSize: 14, lineHeight: 1.5, color: "#2a2823" }}>
                Old client still on a notification action → keeps getting leads
                they no longer pay for. Or the new client is never wired in → gets
                nothing.
              </div>
            </DiagramCard>
            <DiagramCard tone="good" label="Handoff done clean" labelColor="#245740">
              <div style={{ fontSize: 14, lineHeight: 1.5, color: "#2a2823" }}>
                Old assignment ended · new client active · every action repointed
                → leads reach the new client the moment they arrive.
              </div>
            </DiagramCard>
          </div>
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
            <div className="og-panel-body" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--og-serif)", fontSize: 22 }}>Sumter Roofing Company</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <span style={actionBtn}>Reassign</span>
                <span style={actionBtn}>Change rate</span>
                <span style={{ ...actionBtn, borderColor: "#c63f1e", color: "#93290f" }} className="og-ring">
                  Unassign
                </span>
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Node
              icon={<Bell size={12} />}
              iconBg="#8aa542"
              label="Client Email Notification"
              edit
              value={<>TO CUSTOM EMAIL → new client&rsquo;s email</>}
            />
            <NodeConnector />
            <Node
              icon={<MessageSquare size={12} />}
              iconBg="#8aa542"
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
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Panel header="Builder — before">
              <div className="og-panel-body" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--og-mono)", fontSize: 10.5, fontWeight: 600 }}>Draft</span>
                <ToggleSwitch />
                <span style={{ fontFamily: "var(--og-mono)", fontSize: 10.5, color: "#8c877d" }}>Publish</span>
              </div>
            </Panel>
            <span style={{ fontFamily: "var(--og-mono)", fontSize: 20, color: "#c9c4b8" }}>→</span>
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
          <div className="og-stack">
            <Success>Property shows the new client active; old assignment ended.</Success>
            <Success>Test lead reaches the new client — old client gets nothing.</Success>
            <Closing>{CLOSING}</Closing>
          </div>
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

const actionBtn: React.CSSProperties = {
  border: "1px solid #dcd7ca",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#4a4741",
  background: "#fff",
};
