"use client";

import { Bell, FileText, MessageSquare, UserPlus, Webhook } from "lucide-react";

import {
  Body,
  Checklist,
  Closing,
  DiagramCard,
  Field,
  FieldMatters,
  GuideProgress,
  GuideHeader,
  H2,
  MockTable,
  Node,
  NodeConnector,
  Panel,
  Section,
  Step,
  StepVisual,
  StepsLabel,
  Success,
  StatusPill,
  ToggleSwitch,
  Warning,
} from "@/components/guides/operator/primitives";
import { getOperatorGuide } from "@/lib/guides/operator-guides";

const SLUG = "onboard-a-new-client-to-a-property";
const meta = getOperatorGuide(SLUG)!;

// ---- Verbatim copy (shared by both the designed and plain-text tabs) -------
const WHY =
  "A new client is now paying to rent this property and expects its leads to start arriving immediately. If onboarding is half-done — assigned in the dashboard but notifications never set — the client pays and hears nothing, and we look broken on day one. Finish every step before you call it done.";
const BEFORE = [
  "The client's business name and contact name",
  "Their phone and email for lead notifications",
  "Which property they're renting",
  "Access to the dashboard and to Engine Evolve",
];
const STEPS = [
  {
    title: "Open Properties in the dashboard",
    body: "In the dashboard, open Properties and click the property this client is renting.",
  },
  {
    title: "Assign client on the property page",
    body: "On the property page, click Assign client. Pick the client (or add them if they're new), set the rate/terms you were given, and save. The property should now show this client as the current client.",
  },
  {
    title: "Confirm the client in Contacts",
    body: "Log in to Engine Evolve at https://app.enginevolve.com. Open the sub-account / contact for this property and enter or confirm the client's name, phone, and email so they're correct before you route anything to them.",
  },
  {
    title: "Set the recipient in every notification action",
    body: "In Engine Evolve, open Automation → Workflows and open this property's workflow. In each Send Email and Send SMS action, set the recipient to the client's email / phone from step 3.",
    warn: "Repeat for Client SMS Notification: To User Type → Custom phone, then paste the client's phone. Any action left on the old recipient means silence for the client.",
  },
  {
    title: "Save action, then flip Draft to Publish",
    body: "Save and publish the workflow so the new notifications take effect.",
  },
];
const VERIFY =
  "In the dashboard, the property page shows this client as the current client. Then submit a test lead through the property's form (or use Engine Evolve's test action) and confirm the client receives the notification. If they do, onboarding is complete.";
const CLOSING = "If they do, onboarding is complete.";

export function OnboardingDesigned({ initialDone }: { initialDone: string[] }) {
  return (
    <GuideProgress slug={SLUG} stepKeys={meta.stepKeys} initialDone={initialDone}>
      <GuideHeader
        eyebrow="Internal runbook / Property operations"
        title="Onboarding a client onto a rented property"
        xl
        pills={["5 steps", "2 systems"]}
      />

      {/* Why this matters */}
      <Section
        left={
          <>
            <H2>Why this matters</H2>
            <Body>{WHY}</Body>
          </>
        }
        right={
          <div className="og-diagram">
            <DiagramCard tone="bad" label="Half-done onboarding" labelColor="#93290f">
              <div style={{ fontSize: 14, color: "#2a2823", lineHeight: 1.5 }}>
                <strong>✓ Client assigned in dashboard</strong> + ✕ Notification
                actions never set
              </div>
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px dashed #ebc4b4",
                  fontWeight: 500,
                  color: "#93290f",
                }}
              >
                → Client pays, hears nothing. We look broken on day one.
              </div>
            </DiagramCard>
            <DiagramCard tone="good" label="Finished onboarding" labelColor="#245740">
              <div style={{ fontSize: 14, color: "#2a2823", lineHeight: 1.5 }}>
                <strong>✓ Client assigned in dashboard</strong> + ✓ Workflow routed
                &amp; published
              </div>
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px dashed #cce0d4",
                  fontWeight: 500,
                  color: "#245740",
                }}
              >
                → Leads arrive the moment the form is submitted.
              </div>
            </DiagramCard>
          </div>
        }
      />

      {/* Before you start */}
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
            items={BEFORE}
            chips={
              <>
                <span style={chip}>
                  <span style={{ ...sw, background: "#17161a" }} /> Dashboard
                </span>
                <span style={chip}>
                  <span style={{ ...sw, background: "#baf25a" }} /> Engine Evolve
                </span>
              </>
            }
          />
        }
      />

      <StepsLabel />

      <Step
        n={1}
        stepKey="step-1"
        badge={{ label: "Dashboard", variant: "dashboard" }}
        title={STEPS[0].title}
      >
        <Body>{STEPS[0].body}</Body>
        <StepVisual>
          <Panel header="Dashboard — Properties" deep>
            <MockTable>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Client</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 500 }}>Brunswick Tree Service</td>
                  <td style={{ color: "#6b665e" }}>Coastal Yard Co.</td>
                  <td>
                    <StatusPill tone="ok">Active</StatusPill>
                  </td>
                </tr>
                <tr className="og-row-highlight og-ring">
                  <td style={{ fontWeight: 600 }}>Sumter Roofing Company</td>
                  <td style={{ color: "#b0a9a0" }}>—</td>
                  <td>
                    <StatusPill tone="error">Unassigned</StatusPill>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 500 }}>Brunswick Roofing Company</td>
                  <td style={{ color: "#6b665e" }}>Golden Isles Roofing</td>
                  <td>
                    <StatusPill tone="ok">Active</StatusPill>
                  </td>
                </tr>
              </tbody>
            </MockTable>
          </Panel>
        </StepVisual>
      </Step>

      <Step
        n={2}
        stepKey="step-2"
        badge={{ label: "Dashboard", variant: "dashboard" }}
        title={STEPS[1].title}
      >
        <Body>{STEPS[1].body}</Body>
        <StepVisual>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
            }}
            className="og-success"
          >
            <span className="og-check-circle">✓</span>
            <span style={{ fontFamily: "var(--og-mono)", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#245740" }}>
              Current client
            </span>
            <span style={{ fontFamily: "var(--og-serif)", fontSize: 24, color: "#171614" }}>
              Marios Bros Fencing
            </span>
            <span style={{ fontSize: 13, color: "#4a6b5c", marginLeft: "auto" }}>
              $50.00 / lead · Month-to-month
            </span>
          </div>
        </StepVisual>
      </Step>

      <Step
        n={3}
        stepKey="step-3"
        badge={{ label: "Engine Evolve", variant: "ee" }}
        title={STEPS[2].title}
      >
        <Body>
          Log in to Engine Evolve at{" "}
          <a href="https://app.enginevolve.com">https://app.enginevolve.com</a>. Open
          the sub-account / contact for this property and enter or confirm the
          client&rsquo;s name, phone, and email so they&rsquo;re correct before you
          route anything to them.
        </Body>
        <StepVisual>
          <Panel header="Engine Evolve — Contacts / Marios Bros Fencing" deep>
            <div className="og-panel-body" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="First name">Jamie</Field>
                <Field label="Last name">Floyd</Field>
              </div>
              <FieldMatters label="Phone">(912) 555-5555 — goes into Client SMS Notification</FieldMatters>
              <FieldMatters label="Email">Floydjamie18@gmail.com — goes into Client Email Notification</FieldMatters>
            </div>
          </Panel>
        </StepVisual>
      </Step>

      <Step
        n={4}
        stepKey="step-4"
        badge={{ label: "Engine Evolve", variant: "ee" }}
        title={STEPS[3].title}
      >
        <Body>{STEPS[3].body}</Body>
        <StepVisual>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
            <Node icon={<FileText size={12} />} iconBg="#8aa542" label="Form Submitted" />
            <NodeConnector />
            <Node icon={<UserPlus size={12} />} iconBg="#2e5a8f" label="Create contact" />
            <NodeConnector />
            <Node icon={<Webhook size={12} />} iconBg="#2e5a8f" label="Webhook" />
            <NodeConnector />
            <Node
              icon={<Bell size={12} />}
              iconBg="#8aa542"
              label="Client Email Notification"
              edit
              value={<><span style={mono10}>TO CUSTOM EMAIL</span> Floydjamie18@gmail.com</>}
            />
            <NodeConnector />
            <Node
              icon={<MessageSquare size={12} />}
              iconBg="#8aa542"
              label="Client SMS Notification"
              edit
              value={<><span style={mono10}>TO CUSTOM PHONE</span> (912) 555-5555</>}
            />
            <NodeConnector />
            <Node icon={<Bell size={12} />} iconBg="#8c877d" label="Blue Carrot Solutions Internal Notification" />
          </div>
        </StepVisual>
        <StepVisual>
          <Warning>{STEPS[3].warn}</Warning>
        </StepVisual>
        <StepVisual>
          <Body>
            Leave the internal notification pointed at Blue Carrot Solutions — it&rsquo;s
            our internal copy, not the client&rsquo;s.
          </Body>
        </StepVisual>
      </Step>

      <Step
        n={5}
        stepKey="step-5"
        badge={{ label: "Engine Evolve", variant: "ee" }}
        title={STEPS[4].title}
        last
      >
        <Body>{STEPS[4].body}</Body>
        <StepVisual>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Panel header="Builder header — before">
              <div className="og-panel-body" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Sumter Roofing Company</span>
                <span style={{ fontFamily: "var(--og-mono)", fontSize: 10.5, fontWeight: 600 }}>Draft</span>
                <ToggleSwitch />
                <span style={{ fontFamily: "var(--og-mono)", fontSize: 10.5, color: "#8c877d" }}>Publish</span>
              </div>
            </Panel>
            <span style={{ fontFamily: "var(--og-mono)", fontSize: 20, color: "#c9c4b8" }}>→</span>
            <div className="og-diagram-card og-diagram-card--good" style={{ padding: 0, overflow: "hidden" }}>
              <div className="og-diagram-label" style={{ color: "#7fa593", padding: "11px 16px", borderBottom: "1px solid #d8e7de", margin: 0 }}>
                Workflows list — after
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Sumter Roofing Company</span>
                <StatusPill tone="ok">Published</StatusPill>
                <span style={{ fontSize: 12, color: "#4a6b5c" }}>New notifications in effect</span>
              </div>
            </div>
          </div>
        </StepVisual>
      </Step>

      {/* How to check it worked */}
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
            <Success>
              Property page shows <strong>Marios Bros Fencing</strong> as current
              client.
            </Success>
            <Panel header="Dashboard — Leads (test lead)">
              <MockTable>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Jul 29, 11:44 AM</td>
                    <td>Sumter Roofing Company</td>
                    <td style={{ color: "#6b665e" }}>Form</td>
                    <td>
                      <StatusPill tone="ok">Billable</StatusPill>
                    </td>
                  </tr>
                </tbody>
              </MockTable>
            </Panel>
            <Closing>{CLOSING}</Closing>
          </div>
        }
      />
    </GuideProgress>
  );
}

export function OnboardingPlain() {
  return (
    <article className="og-plain">
      <div className="og-plain-eyebrow">Internal runbook / Property operations</div>
      <h1>Onboarding a client onto a rented property</h1>

      <h2>Why this matters</h2>
      <p>{WHY}</p>

      <h2>Before you start</h2>
      <p>Have on hand:</p>
      <ul>
        {BEFORE.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <h2>Steps</h2>
      {STEPS.map((s, i) => (
        <div key={i}>
          <h3>
            {i + 1}. {s.title}
          </h3>
          <p>{s.body}</p>
          {s.warn ? <p className="og-plain-warn">⚠️ WARNING: {s.warn}</p> : null}
        </div>
      ))}

      <h2>How to check it worked</h2>
      <p>{VERIFY}</p>
    </article>
  );
}

// Small local helpers.
const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 9,
  border: "1px solid #e3dfd5",
  background: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  fontFamily: "var(--og-mono)",
  fontSize: 12,
  color: "#2a2823",
};
const sw: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 4,
  display: "inline-block",
};
const mono10: React.CSSProperties = {
  fontFamily: "var(--og-mono)",
  fontSize: 9.5,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "#c08d7c",
  marginRight: 6,
};
