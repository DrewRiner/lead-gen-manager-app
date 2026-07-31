"use client";

import { Bell, FileText, MessageSquare, UserPlus, Webhook } from "lucide-react";
import type { ReactNode } from "react";

import {
  Body,
  Checklist,
  Chip,
  Closing,
  Compare,
  DiagramCard,
  Field,
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
          <Compare>
            <DiagramCard tone="bad" label="Half-done onboarding">
              <strong>✓ Client assigned in dashboard</strong> + ✕ Notification
              actions never set
              <div className="mt-3 border-t border-dashed border-amber-300 pt-3 font-medium text-amber-700 dark:border-amber-900 dark:text-amber-400">
                → Client pays, hears nothing. We look broken on day one.
              </div>
            </DiagramCard>
            <DiagramCard tone="good" label="Finished onboarding">
              <strong>✓ Client assigned in dashboard</strong> + ✓ Workflow routed
              &amp; published
              <div className="mt-3 border-t border-dashed border-emerald-300 pt-3 font-medium text-emerald-700 dark:border-emerald-900 dark:text-emerald-400">
                → Leads arrive the moment the form is submitted.
              </div>
            </DiagramCard>
          </Compare>
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
                <Chip color="#64748b">Dashboard</Chip>
                <Chip color="#84cc16">Engine Evolve</Chip>
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
                  <td className="font-medium">Brunswick Tree Service</td>
                  <td className="text-muted-foreground">Coastal Yard Co.</td>
                  <td>
                    <StatusPill tone="ok">Active</StatusPill>
                  </td>
                </tr>
                <tr className="bg-primary/5 ring-1 ring-inset ring-primary/20">
                  <td className="font-semibold">Sumter Roofing Company</td>
                  <td className="text-muted-foreground/70">—</td>
                  <td>
                    <StatusPill tone="error">Unassigned</StatusPill>
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">Brunswick Roofing Company</td>
                  <td className="text-muted-foreground">Golden Isles Roofing</td>
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
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-emerald-300 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-sm text-white">
              ✓
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Current client
            </span>
            <span className="text-xl font-semibold">Marios Bros Fencing</span>
            <span className="ml-auto text-sm text-muted-foreground">
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
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2.5">
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
          <div className="flex flex-col items-center">
            <Node icon={<FileText size={12} />} iconBg="#65a30d" label="Form Submitted" />
            <NodeConnector />
            <Node icon={<UserPlus size={12} />} iconBg="#2563eb" label="Create contact" />
            <NodeConnector />
            <Node icon={<Webhook size={12} />} iconBg="#2563eb" label="Webhook" />
            <NodeConnector />
            <Node
              icon={<Bell size={12} />}
              iconBg="#65a30d"
              label="Client Email Notification"
              edit
              value={<><Tag>To custom email</Tag> Floydjamie18@gmail.com</>}
            />
            <NodeConnector />
            <Node
              icon={<MessageSquare size={12} />}
              iconBg="#65a30d"
              label="Client SMS Notification"
              edit
              value={<><Tag>To custom phone</Tag> (912) 555-5555</>}
            />
            <NodeConnector />
            <Node icon={<Bell size={12} />} iconBg="#78716c" label="Blue Carrot Solutions Internal Notification" />
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
          <div className="flex flex-wrap items-center gap-4">
            <Panel header="Builder header — before">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-sm font-semibold">Sumter Roofing Company</span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">Draft</span>
                <ToggleSwitch />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Publish</span>
              </div>
            </Panel>
            <span aria-hidden className="text-xl text-muted-foreground">→</span>
            <div className="overflow-hidden rounded-lg border border-emerald-300 dark:border-emerald-900">
              <div className="border-b border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
                Workflows list — after
              </div>
              <div className="flex flex-wrap items-center gap-2.5 p-4">
                <span className="text-sm font-semibold">Sumter Roofing Company</span>
                <StatusPill tone="ok">Published</StatusPill>
                <span className="text-xs text-muted-foreground">New notifications in effect</span>
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
          <Stack>
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
                    <td className="text-muted-foreground">Form</td>
                    <td>
                      <StatusPill tone="ok">Billable</StatusPill>
                    </td>
                  </tr>
                </tbody>
              </MockTable>
            </Panel>
            <Closing>{CLOSING}</Closing>
          </Stack>
        }
      />
    </GuideProgress>
  );
}

export function OnboardingPlain() {
  return (
    <PlainGuide
      eyebrow="Internal runbook / Property operations"
      title="Onboarding a client onto a rented property"
      why={WHY}
      before={BEFORE}
      steps={STEPS}
      verify={VERIFY}
    />
  );
}

/** Small mono uppercase tag used inside workflow-node values. */
function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}
