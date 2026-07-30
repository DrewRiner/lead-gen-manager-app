"use client";

import "./operator-guide.css";

import Link from "next/link";
import { Check } from "lucide-react";
import {
  Fragment,
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { toggleGuideStep } from "@/lib/actions/guide-progress";
import { OPERATOR_GUIDES } from "@/lib/guides/operator-guides";
import { cn } from "@/lib/utils";

// ===========================================================================
// Reusable operator-guide component library. Built ONCE, reused across all nine
// guides. Interactive pieces (Done toggles + counter) share a per-user progress
// context; everything else is static presentation over the design-system CSS.
// ===========================================================================

type ProgressValue = {
  done: Set<string>;
  toggle: (key: string) => void;
  stepKeys: string[];
};
const ProgressCtx = createContext<ProgressValue | null>(null);
function useProgress(): ProgressValue {
  const ctx = useContext(ProgressCtx);
  if (!ctx) throw new Error("useProgress must be used inside <GuideRoot>");
  return ctx;
}

export function GuideProgress({
  slug,
  stepKeys,
  initialDone,
  children,
}: {
  slug: string;
  stepKeys: string[];
  initialDone: string[];
  children: ReactNode;
}) {
  const [done, setDone] = useState<Set<string>>(() => new Set(initialDone));

  function toggle(key: string) {
    const willBeDone = !done.has(key);
    setDone((prev) => {
      const next = new Set(prev);
      if (willBeDone) next.add(key);
      else next.delete(key);
      return next;
    });
    // Persist per-user (fire-and-forget; UI already updated optimistically).
    void toggleGuideStep({ guideSlug: slug, stepKey: key, done: willBeDone });
  }

  // The `.og` paper shell + page container are provided by GuideTabs so the two
  // tabs share one surface; here we add the progress context + the nav strip.
  return (
    <ProgressCtx.Provider value={{ done, toggle, stepKeys }}>
      <GuideNav current={slug} />
      {children}
    </ProgressCtx.Provider>
  );
}

function GuideNav({ current }: { current: string }) {
  return (
    <nav className="og-nav" aria-label="Guides">
      {OPERATOR_GUIDES.map((g) =>
        g.slug === current ? (
          <span key={g.slug} className="og-pill og-pill--active" aria-current="page">
            {g.navLabel}
          </span>
        ) : (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="og-pill">
            {g.navLabel}
          </Link>
        ),
      )}
    </nav>
  );
}

export function StepCounter() {
  const { done, stepKeys } = useProgress();
  const n = stepKeys.filter((k) => done.has(k)).length;
  return (
    <span className="og-counter">
      {n} of {stepKeys.length} steps checked off
    </span>
  );
}

export function GuideHeader({
  eyebrow,
  alertEyebrow,
  title,
  xl,
  sub,
  pills,
}: {
  eyebrow: string;
  alertEyebrow?: boolean;
  title: ReactNode;
  xl?: boolean;
  sub?: ReactNode;
  /** Small count pills, e.g. ["5 steps", "2 systems"]. */
  pills?: string[];
}) {
  return (
    <header className="og-header">
      <div>
        <div className={cn("og-eyebrow", alertEyebrow && "og-eyebrow--alert")}>
          {eyebrow}
        </div>
        <h1 className={cn("og-h1", xl && "og-h1--xl")}>{title}</h1>
        {sub ? <p className="og-sub">{sub}</p> : null}
      </div>
      <div className="og-header-meta">
        {pills && pills.length > 0 ? (
          <div style={{ display: "flex", gap: 8 }}>
            {pills.map((p) => (
              <span key={p} className="og-count-pill">
                {p}
              </span>
            ))}
          </div>
        ) : null}
        <StepCounter />
      </div>
    </header>
  );
}

export function Section({
  variant,
  left,
  right,
}: {
  variant?: "rule" | "verify";
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <section
      className={cn(
        "og-section",
        variant === "rule" && "og-section--rule",
        variant === "verify" && "og-section--verify",
      )}
    >
      <div>{left}</div>
      <div>{right}</div>
    </section>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="og-h2">{children}</h2>;
}
export function Body({ children }: { children: ReactNode }) {
  return <p className="og-body">{children}</p>;
}
export function Stack({ children }: { children: ReactNode }) {
  return <div className="og-stack">{children}</div>;
}
export function StepsLabel() {
  return <div className="og-steps-label">Steps</div>;
}

type BadgeVariant = "dashboard" | "ee" | "twilio" | "critical";
export function SystemBadge({
  label,
  variant,
}: {
  label: string;
  variant: BadgeVariant;
}) {
  return <span className={`og-badge og-badge--${variant}`}>{label}</span>;
}

export function Step({
  n,
  stepKey,
  badge,
  title,
  children,
  last,
}: {
  n: number;
  stepKey: string;
  badge?: { label: string; variant: BadgeVariant };
  title: ReactNode;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn("og-step", last && "og-step--last")}>
      <div className="og-step-rail">
        <div className="og-numeral">{n}</div>
        {badge ? <SystemBadge {...badge} /> : null}
        <DoneToggle stepKey={stepKey} />
      </div>
      <div className="og-step-body">
        <h3 className="og-h3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function DoneToggle({ stepKey }: { stepKey: string }) {
  const { done, toggle } = useProgress();
  const isDone = done.has(stepKey);
  return (
    <button
      type="button"
      className="og-done"
      data-done={isDone}
      aria-pressed={isDone}
      onClick={() => toggle(stepKey)}
    >
      <span className="og-done-box">
        {isDone ? <Check size={11} strokeWidth={3} /> : null}
      </span>
      {isDone ? "Done" : "Mark done"}
    </button>
  );
}

export function StepVisual({ children }: { children: ReactNode }) {
  return <div className="og-step-visual">{children}</div>;
}

export function Panel({
  header,
  children,
  deep,
  className,
  ring,
}: {
  header?: ReactNode;
  children: ReactNode;
  deep?: boolean;
  className?: string;
  ring?: boolean;
}) {
  return (
    <div className={cn("og-panel", deep && "og-panel--deep", ring && "og-ring", className)}>
      {header != null ? <div className="og-panel-header">{header}</div> : null}
      {children}
    </div>
  );
}
export function PanelBody({ children }: { children: ReactNode }) {
  return <div className="og-panel-body">{children}</div>;
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="og-warning">
      <span className="og-warning-tag">WARNING</span>
      <div className="og-warning-body">{children}</div>
    </div>
  );
}

export function Success({ children }: { children: ReactNode }) {
  return (
    <div className="og-success">
      <span className="og-check-circle">
        <Check size={13} strokeWidth={3} />
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Closing({ children }: { children: ReactNode }) {
  return (
    <div className="og-closing">
      <span className="og-closing-circle">
        <Check size={14} strokeWidth={3} />
      </span>
      <div className="og-closing-text">{children}</div>
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "error" | "draft" | "neutral";
  children: ReactNode;
}) {
  return <span className={`og-status og-status--${tone}`}>{children}</span>;
}

export function Field({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {label ? <div className="og-field-label">{label}</div> : null}
      <div className="og-field">{children}</div>
    </div>
  );
}

export function FieldMatters({
  label,
  children,
  caret,
}: {
  label?: string;
  children: ReactNode;
  caret?: boolean;
}) {
  return (
    <div>
      {label ? <div className="og-field-label">{label}</div> : null}
      <div className="og-field og-field--matters">
        {children}
        {caret ? <span className="og-caret" /> : null}
      </div>
    </div>
  );
}

export function MockTable({ children }: { children: ReactNode }) {
  return (
    <div className="og-table-scroll">
      <table className="og-table">{children}</table>
    </div>
  );
}

export function Node({
  icon,
  iconBg,
  label,
  edit,
  value,
}: {
  icon: ReactNode;
  iconBg: string;
  label: ReactNode;
  edit?: boolean;
  value?: ReactNode;
}) {
  return (
    <div className={cn("og-node", edit && "og-node--edit")}>
      <div className="og-node-head">
        <span
          className="og-node-icon"
          style={{ background: iconBg, color: "#fff" }}
        >
          {icon}
        </span>
        {label}
      </div>
      {value != null ? <div className="og-node-value">{value}</div> : null}
    </div>
  );
}
export function NodeConnector() {
  return <div className="og-node-connector" />;
}

export function Crumbs({ items }: { items: string[] }) {
  return (
    <div className="og-crumbs">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="og-crumb-sep">→</span> : null}
          <span className={cn("og-crumb", i === items.length - 1 && "og-crumb--current")}>
            {it}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

export function CodeBlock({
  method,
  children,
}: {
  method?: string;
  children: ReactNode;
}) {
  return (
    <div className="og-code">
      {method ? <span className="og-code-method">{method}</span> : null}
      <span>{children}</span>
    </div>
  );
}

export function ToggleSwitch({ on }: { on?: boolean }) {
  return <span className={cn("og-switch", on && "og-switch--on")} />;
}

export function Checklist({
  title = "Pre-flight",
  items,
  chips,
}: {
  title?: string;
  items: ReactNode[];
  chips?: ReactNode;
}) {
  return (
    <Panel header={title}>
      {items.map((it, i) => (
        <div key={i} className="og-checklist-row">
          <span className="og-checkbox" />
          <span>{it}</span>
        </div>
      ))}
      {chips ? (
        <div className="og-checklist-row" style={{ gap: 10, flexWrap: "wrap" }}>
          {chips}
        </div>
      ) : null}
    </Panel>
  );
}

/** The real Command Center sidebar, as a static figure inside a mockup. */
export function MockSidebar({ active }: { active: string }) {
  const items = [
    "Dashboard",
    "Properties",
    "Clients",
    "Leads",
    "Reports",
    "Guides",
    "Settings",
  ];
  return (
    <div className="og-mocksb">
      {items.map((it) => (
        <div
          key={it}
          className={cn("og-mocksb-item", it === active && "og-mocksb-item--active")}
        >
          {it}
        </div>
      ))}
    </div>
  );
}

/** The clean, copyable/printable "Plain text" tab, rendered from guide data. */
export function PlainGuide({
  eyebrow,
  title,
  why,
  beforeLead = "Have on hand:",
  before,
  steps,
  verify,
}: {
  eyebrow: string;
  title: string;
  why: string;
  beforeLead?: string;
  before: string[];
  steps: { title: string; body: string; warn?: string; warns?: string[] }[];
  verify: string;
}) {
  return (
    <article className="og-plain">
      <div className="og-plain-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>

      <h2>Why this matters</h2>
      <p>{why}</p>

      <h2>Before you start</h2>
      <p>{beforeLead}</p>
      <ul>
        {before.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <h2>Steps</h2>
      {steps.map((s, i) => (
        <div key={i}>
          <h3>
            {i + 1}. {s.title}
          </h3>
          <p>{s.body}</p>
          {s.warn ? <p className="og-plain-warn">⚠️ WARNING: {s.warn}</p> : null}
          {(s.warns ?? []).map((w, j) => (
            <p key={j} className="og-plain-warn">
              ⚠️ WARNING: {w}
            </p>
          ))}
        </div>
      ))}

      <h2>How to check it worked</h2>
      <p>{verify}</p>
    </article>
  );
}

export function DiagramCard({
  tone,
  label,
  labelColor,
  children,
}: {
  tone?: "bad" | "good" | "neutral";
  label?: string;
  labelColor?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "og-diagram-card",
        tone === "bad" && "og-diagram-card--bad",
        tone === "good" && "og-diagram-card--good",
      )}
    >
      {label ? (
        <div className="og-diagram-label" style={{ color: labelColor }}>
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}
