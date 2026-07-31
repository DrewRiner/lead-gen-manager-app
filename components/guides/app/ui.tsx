"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import {
  Fragment,
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { YouTubeEmbed } from "@/components/youtube-embed";
import { toggleGuideStep } from "@/lib/actions/guide-progress";
import { cn } from "@/lib/utils";

// ===========================================================================
// App-styled operator-guide primitives. Keeps the OLD paper layout & rhythm —
// wide numbered step rail, rule-separated steps, asymmetric two-column sections,
// generous spacing, paired comparison callouts — but on the app background with
// Tailwind/shadcn tokens (no tan, no mono eyebrows, no pill nav). Serif vs sans
// for display type is a live toggle (GuideShell) so it can be A/B'd at one URL.
// ===========================================================================

type ProgressValue = { done: Set<string>; toggle: (k: string) => void; stepKeys: string[] };
const Ctx = createContext<ProgressValue | null>(null);
function useProgress() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useProgress must be inside <GuideProgress>");
  return c;
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
    void toggleGuideStep({ guideSlug: slug, stepKey: key, done: willBeDone });
  }
  return <Ctx.Provider value={{ done, toggle, stepKeys }}>{children}</Ctx.Provider>;
}

function StepCounter() {
  const { done, stepKeys } = useProgress();
  const n = stepKeys.filter((k) => done.has(k)).length;
  return (
    <span className="whitespace-nowrap text-xs text-muted-foreground">
      {n} of {stepKeys.length} checked off
    </span>
  );
}

export function GuideHeader({
  eyebrow,
  alertEyebrow,
  title,
  sub,
  pills,
  videoId,
}: {
  eyebrow: string;
  alertEyebrow?: boolean;
  title: ReactNode;
  sub?: ReactNode;
  pills?: string[];
  /** Optional YouTube walkthrough, shown above the steps. */
  videoId?: string;
}) {
  return (
    <header className="mb-4 border-b pb-8">
      <div className="grid gap-6 sm:grid-cols-[1fr,auto] sm:items-end">
        <div className="min-w-0">
          <div
            className={cn(
              "mb-3 text-xs font-medium uppercase tracking-[0.14em]",
              alertEyebrow ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {eyebrow}
          </div>
          <h1 className="max-w-[20ch] text-4xl font-semibold leading-tight tracking-tight text-balance">
            {title}
          </h1>
          {sub ? (
            <p className="mt-4 max-w-[54ch] text-lg leading-relaxed text-muted-foreground">
              {sub}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {pills && pills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pills.map((p) => (
                <span
                  key={p}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {p}
                </span>
              ))}
            </div>
          ) : null}
          <StepCounter />
        </div>
      </div>
      {videoId ? (
        <div className="mt-6 max-w-2xl">
          <YouTubeEmbed videoId={videoId} title={typeof title === "string" ? title : undefined} />
        </div>
      ) : null}
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
        "grid items-start gap-x-14 gap-y-6 py-12 md:grid-cols-[minmax(0,1fr),minmax(0,1.05fr)]",
        variant !== "verify" && "border-b",
        variant === "verify" && "md:grid-cols-[minmax(0,1fr),minmax(0,1.15fr)]",
      )}
    >
      <div className="space-y-4">{left}</div>
      <div>{right}</div>
    </section>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-2xl font-semibold tracking-tight">{children}</h2>;
}
export function Body({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline">
      {children}
    </p>
  );
}
export function Stack({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
export function StepsLabel() {
  return (
    <div className="pb-2 pt-12 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      Steps
    </div>
  );
}

type BadgeVariant = "dashboard" | "ee" | "twilio" | "critical";
const BADGE: Record<BadgeVariant, string> = {
  dashboard: "bg-muted text-muted-foreground border",
  ee: "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300",
  twilio: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  critical: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};
export function SystemBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
        BADGE[variant],
      )}
    >
      {label}
    </span>
  );
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
    <div
      className={cn(
        "grid gap-6 border-t py-9 md:grid-cols-[128px,minmax(0,1fr)] md:gap-8",
        last && "border-b",
      )}
    >
      <div className="flex flex-row items-center gap-4 md:flex-col md:items-start md:gap-4">
        <div className="guide-numeral text-5xl leading-none tabular-nums md:text-[64px]">
          {n}
        </div>
        {badge ? <SystemBadge {...badge} /> : null}
        <DoneToggle stepKey={stepKey} />
      </div>
      <div className="min-w-0 space-y-3">
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
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
      onClick={() => toggle(stepKey)}
      aria-pressed={isDone}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
        isDone
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "grid h-4 w-4 place-items-center rounded border",
          isDone ? "border-primary bg-primary text-primary-foreground" : "bg-background",
        )}
      >
        {isDone ? <Check size={11} strokeWidth={3} /> : null}
      </span>
      {isDone ? "Done" : "Mark done"}
    </button>
  );
}

export function StepVisual({ children }: { children: ReactNode }) {
  return <div className="mt-5">{children}</div>;
}

export function Panel({
  header,
  children,
  deep,
  className,
}: {
  header?: ReactNode;
  children: ReactNode;
  deep?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border", deep && "bg-muted/30", className)}>
      {header != null ? (
        <div className="border-b bg-muted/40 px-3.5 py-2.5 text-xs font-medium text-muted-foreground">
          {header}
        </div>
      ) : null}
      <div className="p-3.5 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
export function PanelBody({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-md border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
      <span className="mt-px shrink-0 text-[10px] font-bold uppercase tracking-wider">Warning</span>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Success({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
        <Check size={11} strokeWidth={3} />
      </span>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

export function Closing({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
      <Check size={15} strokeWidth={3} className="shrink-0" />
      <div>{children}</div>
    </div>
  );
}

const TONE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  neutral: "bg-muted text-muted-foreground",
};
export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "error" | "draft" | "neutral";
  children: ReactNode;
}) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TONE[tone])}>
      {children}
    </span>
  );
}

export function Field({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      {label ? (
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      ) : null}
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

export function FieldMatters({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      {label ? (
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      ) : null}
      <div className="rounded-md border bg-background px-2.5 py-1.5 text-sm font-medium tabular-nums">
        {children}
      </div>
    </div>
  );
}

export function MockTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_thead]:border-b [&_tbody_tr]:border-t">
        {children}
      </table>
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
    <div
      className={cn(
        "w-full max-w-sm rounded-lg border px-3.5 py-2.5",
        edit && "border-primary/50 ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-white"
          style={{ background: iconBg }}
        >
          {icon}
        </span>
        {label}
      </div>
      {value != null ? (
        <div className="mt-1 text-xs tabular-nums text-muted-foreground">{value}</div>
      ) : null}
    </div>
  );
}
export function NodeConnector() {
  return <div className="my-1 h-5 w-px bg-border" />;
}

export function ToggleSwitch({ on }: { on?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-7 items-center rounded-full p-0.5",
        on ? "bg-primary" : "bg-muted",
      )}
    >
      <span className={cn("h-3 w-3 rounded-full bg-background transition", on && "translate-x-3")} />
    </span>
  );
}

export function Checklist({
  title = "Pre-flight",
  items,
}: {
  title?: string;
  items: ReactNode[];
}) {
  return (
    <Panel header={title}>
      <div className="space-y-2.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded border" />
            <span className="text-sm leading-relaxed">{it}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Paired comparison callouts (e.g. half-configured vs done). Stacks on narrow. */
export function DiagramCard({
  tone,
  label,
  children,
}: {
  tone?: "bad" | "good" | "neutral";
  label?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "bad" && "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
        tone === "good" && "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
      )}
    >
      {label ? (
        <div
          className={cn(
            "mb-2 text-xs font-semibold uppercase tracking-wider",
            tone === "bad" && "text-amber-700 dark:text-amber-400",
            tone === "good" && "text-emerald-700 dark:text-emerald-400",
            !tone && "text-muted-foreground",
          )}
        >
          {label}
        </div>
      ) : null}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
/** Wrap two DiagramCards for the side-by-side (stacking) comparison. */
export function Compare({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function Crumbs({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 ? <span aria-hidden>→</span> : null}
          <span
            className={cn(
              "rounded border px-1.5 py-0.5",
              i === items.length - 1 && "font-medium text-foreground",
            )}
          >
            {it}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

export function PlainGuide({
  eyebrow,
  title,
  note,
  why,
  beforeLead = "Have on hand:",
  before,
  steps,
  verify,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  why: string;
  beforeLead?: string;
  before: string[];
  steps: { title: string; body: string; warn?: string; warns?: string[] }[];
  verify: string;
}) {
  return (
    <article className="max-w-2xl space-y-3 text-[15px] leading-relaxed">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {note ? <p className="text-muted-foreground">{note}</p> : null}

      <h2 className="pt-3 text-xl font-semibold">Why this matters</h2>
      <p className="text-muted-foreground">{why}</p>

      <h2 className="pt-3 text-xl font-semibold">Before you start</h2>
      <p className="text-muted-foreground">{beforeLead}</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        {before.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <h2 className="pt-3 text-xl font-semibold">Steps</h2>
      {steps.map((s, i) => (
        <div key={i} className="space-y-1">
          <h3 className="text-base font-semibold">
            {i + 1}. {s.title}
          </h3>
          <p className="text-muted-foreground">{s.body}</p>
          {s.warn ? <p className="font-medium text-amber-700 dark:text-amber-400">⚠ {s.warn}</p> : null}
          {(s.warns ?? []).map((w, j) => (
            <p key={j} className="font-medium text-amber-700 dark:text-amber-400">⚠ {w}</p>
          ))}
        </div>
      ))}

      <h2 className="pt-3 text-xl font-semibold">How to check it worked</h2>
      <p className="text-muted-foreground">{verify}</p>
    </article>
  );
}

/** App-styled shell: back link, Guide/Plain toggle, and a live serif-vs-sans
 *  headings toggle (data-guide-headings drives the CSS in globals.css). */
export function GuideShell({ guide, plain }: { guide: ReactNode; plain: ReactNode }) {
  const [tab, setTab] = useState<"guide" | "plain">("guide");
  const [headings, setHeadings] = useState<"sans" | "serif">("sans");
  return (
    <div data-guide-headings={headings} className="mx-auto max-w-4xl">
      <Link
        href="/guides"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> All guides
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5" role="tablist">
          {(["guide", "plain"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "guide" ? "Guide" : "Plain text"}
            </button>
          ))}
        </div>

        {/* Temporary A/B: pick serif or sans for display headings. */}
        <div className="inline-flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Headings</span>
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
            {(["sans", "serif"] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHeadings(h)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  headings === h ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div hidden={tab !== "guide"}>{guide}</div>
      <div hidden={tab !== "plain"}>{plain}</div>
    </div>
  );
}
