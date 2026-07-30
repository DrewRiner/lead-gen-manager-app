"use client";

import { Bell, MessageSquare } from "lucide-react";

import {
  Body,
  Checklist,
  Closing,
  FieldMatters,
  GuideHeader,
  GuideProgress,
  H2,
  MockTable,
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

const SLUG = "update-a-clients-phone-or-email";
const meta = getOperatorGuide(SLUG)!;

const WHY =
  "If a client's phone or email is out of date, their leads are being delivered to a dead number or an inbox nobody checks. The client is silently missing leads they're paying for — and when they notice, they blame us. The new info has to be updated in every place it's used, not just one.";
const BEFORE = [
  "The client's new phone and/or email",
  "Which properties this client rents (the client's page in the dashboard lists them)",
];
const STEPS: { title: string; body: string; warn?: string }[] = [
  {
    title: "Edit the client record in Clients",
    body: "In the dashboard, open Clients, find the client, and edit their record with the new phone/email. Save.",
  },
  {
    title: "List every property they rent",
    body: "On the client's page, note every property they rent — you'll need to update each one's notifications.",
  },
  {
    title: "Update the contact record in Contacts",
    body: "Log in to Engine Evolve at https://app.enginevolve.com and update the client's contact record with the new phone/email.",
  },
  {
    title: "Replace the recipient in each property's workflow",
    body: "For each of the client's properties, open its workflow in Engine Evolve (Automation → Workflows) and replace the old email/number with the new one in every Send Email and Send SMS action. A property often has more than one — don't miss any.",
    warn: "Scroll the whole canvas before you close a workflow. A second email or SMS step further down a branch — or an old address sitting in Cc / Bcc — is exactly how a client keeps missing leads after an “update”.",
  },
  {
    title: "Publish every workflow you touched",
    body: "Save and publish each workflow you changed.",
  },
];
const VERIFY =
  "Send a test lead for one of the client's properties and confirm the notification reaches the new contact — and that nothing arrives at the old number/inbox. Repeat for each property if you want to be certain.";
const CLOSING = "New contact receives. Old one hears nothing.";
const BADGES = [
  { label: "Dashboard", variant: "dashboard" as const },
  { label: "Dashboard", variant: "dashboard" as const },
  { label: "Engine Evolve", variant: "ee" as const },
  { label: "Engine Evolve", variant: "ee" as const },
  { label: "Engine Evolve", variant: "ee" as const },
];

export function UpdateContactDesigned({ initialDone }: { initialDone: string[] }) {
  return (
    <GuideProgress slug={SLUG} stepKeys={meta.stepKeys} initialDone={initialDone}>
      <GuideHeader
        eyebrow="Internal runbook / Client records"
        title="Update a client's phone number or email"
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
          <Panel header="Where the number/email is used">
            <div className="og-panel-body" style={{ fontSize: 14, lineHeight: 1.6, color: "#2a2823" }}>
              The same phone/email lives in the dashboard client record, the Engine
              Evolve contact, and <strong>every notification action in every one of
              their properties&rsquo; workflows</strong>. Miss one and the client
              silently stops hearing about leads.
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

      <Step n={1} stepKey="step-1" badge={BADGES[0]} title={STEPS[0].title}>
        <Body>{STEPS[0].body}</Body>
        <StepVisual>
          <Panel header="Dashboard — Clients / Marios Bros Fencing" deep>
            <div className="og-panel-body" style={{ display: "grid", gap: 12 }}>
              <FieldMatters label="Phone">(912) 555-0177</FieldMatters>
              <FieldMatters label="Email">floydjamie18@gmail.com</FieldMatters>
            </div>
          </Panel>
        </StepVisual>
      </Step>

      <Step n={2} stepKey="step-2" badge={BADGES[1]} title={STEPS[1].title}>
        <Body>{STEPS[1].body}</Body>
        <StepVisual>
          <Panel header="Client — Marios Bros Fencing · 2 properties">
            <MockTable>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sumter Roofing Company</td>
                  <td>
                    <StatusPill tone="ok">Active</StatusPill>
                  </td>
                </tr>
                <tr>
                  <td>Brunswick Fence Company</td>
                  <td>
                    <StatusPill tone="ok">Active</StatusPill>
                  </td>
                </tr>
              </tbody>
            </MockTable>
          </Panel>
        </StepVisual>
      </Step>

      <Step n={3} stepKey="step-3" badge={BADGES[2]} title={STEPS[2].title}>
        <Body>
          Log in to Engine Evolve at{" "}
          <a href="https://app.enginevolve.com">https://app.enginevolve.com</a> and
          update the client&rsquo;s contact record with the new phone/email.
        </Body>
      </Step>

      <Step n={4} stepKey="step-4" badge={BADGES[3]} title={STEPS[3].title}>
        <Body>{STEPS[3].body}</Body>
        <StepVisual>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Node
              icon={<Bell size={12} />}
              iconBg="#8aa542"
              label="Client Email Notification"
              edit
              value={<>TO CUSTOM EMAIL → new email</>}
            />
            <NodeConnector />
            <Node
              icon={<MessageSquare size={12} />}
              iconBg="#8aa542"
              label="Client SMS Notification"
              edit
              value={<>TO CUSTOM PHONE → new phone</>}
            />
          </div>
        </StepVisual>
        <StepVisual>
          <Warning>{STEPS[3].warn}</Warning>
        </StepVisual>
      </Step>

      <Step n={5} stepKey="step-5" badge={BADGES[4]} title={STEPS[4].title} last>
        <Body>{STEPS[4].body}</Body>
        <StepVisual>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "var(--og-mono)", fontSize: 10.5, fontWeight: 600 }}>Draft</span>
            <ToggleSwitch />
            <span style={{ fontFamily: "var(--og-mono)", fontSize: 10.5, color: "#8c877d" }}>Publish</span>
            <span style={{ fontFamily: "var(--og-mono)", fontSize: 18, color: "#c9c4b8" }}>→</span>
            <StatusPill tone="ok">Published</StatusPill>
            <span style={{ fontSize: 13, color: "#4a6b5c" }}>Repeat for every property they rent</span>
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
            <Success>Test lead reaches the new contact.</Success>
            <Success>Nothing arrives at the old number/inbox.</Success>
            <Closing>{CLOSING}</Closing>
          </div>
        }
      />
    </GuideProgress>
  );
}

export function UpdateContactPlain() {
  return (
    <PlainGuide
      eyebrow="Internal runbook / Client records"
      title="Update a client's phone number or email"
      why={WHY}
      before={BEFORE}
      steps={STEPS}
      verify={VERIFY}
    />
  );
}
