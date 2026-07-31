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
// App-styled operator-guide primitives (Tailwind + shadcn tokens). Replaces the
// retired warm-paper `.og` design system. Same component API/content contract as
// the old primitives, so guides migrate by import swap. Nav lives in the app
// sidebar now, so there's no in-guide nav strip here.
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
    <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {n} of {stepKeys.length} checked off
    </span>
  );
}

export function GuideHeader({
  eyebrow,
  title,
  sub,
  pills,
  videoId,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  pills?: string[];
  /** Optional YouTube walkthrough, shown above the steps. */
  videoId?: string;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {sub ? <p className="text-sm text-muted-foreground">{sub}</p> : null}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {pills?.map((p) => (
            <span
              key={p}
              className="rounded-full border px-2 py-1 text-xs text-muted-foreground"
            >
              {p}
            </span>
          ))}
          <StepCounter />
        </div>
      </div>
      {videoId ? (
        <div className="mt-5 max-w-2xl">
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
        "grid gap-x-10 gap-y-4 md:grid-cols-2",
        variant && "mt-10 border-t pt-10",
      )}
    >
      <div className="space-y-2">{left}</div>
      <div>{right}</div>
    </section>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold tracking-tight">{children}</h2>;
}
export function Body({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline">{children}</p>;
}
export function Stack({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}
export function StepsLabel() {
  return (
    <div className="mt-10 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Steps
    </div>
  );
}

type BadgeVariant = "dashboard" | "ee" | "twilio" | "critical";
const BADGE: Record<BadgeVariant, string> = {
  dashboard: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ee: "bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300",
  twilio: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  critical: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};
export function SystemBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE[variant])}>
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
    <div className="flex gap-4 py-6">
      <div className="flex w-16 flex-col items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-full border bg-muted text-sm font-semibold tabular-nums">
          {n}
        </div>
        {badge ? <SystemBadge {...badge} /> : null}
        <DoneToggle stepKey={stepKey} />
      </div>
      <div className={cn("min-w-0 flex-1 space-y-3", !last && "border-b pb-2")}>
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
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
        "flex flex-col items-center gap-1 text-[10px] font-medium",
        isDone ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "grid h-5 w-5 place-items-center rounded-md border",
          isDone ? "border-primary bg-primary text-primary-foreground" : "bg-background",
        )}
      >
        {isDone ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      {isDone ? "Done" : "Mark"}
    </button>
  );
}

export function StepVisual({ children }: { children: ReactNode }) {
  return <div className="mt-3">{children}</div>;
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
        <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          {header}
        </div>
      ) : null}
      <div className="p-3 text-sm">{children}</div>
    </div>
  );
}
export function PanelBody({ children }: { children: ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
      <span className="mt-px text-[10px] font-bold uppercase tracking-wide">Warning</span>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Success({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
        <Check size={11} strokeWidth={3} />
      </span>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

export function Closing({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
      <Check size={15} strokeWidth={3} />
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
        "w-full max-w-xs rounded-lg border px-3 py-2",
        edit && "border-primary/50 ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <span
          className="grid h-5 w-5 place-items-center rounded text-white"
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
  return <div className="my-1 h-4 w-px bg-border" />;
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
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-0.5 h-4 w-4 shrink-0 rounded border" />
            <span className="text-sm">{it}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
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
    <article className="max-w-2xl space-y-3 text-sm leading-relaxed">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {eyebrow}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {note ? <p className="text-muted-foreground">{note}</p> : null}

      <h2 className="pt-2 text-base font-semibold">Why this matters</h2>
      <p className="text-muted-foreground">{why}</p>

      <h2 className="pt-2 text-base font-semibold">Before you start</h2>
      <p className="text-muted-foreground">{beforeLead}</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        {before.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <h2 className="pt-2 text-base font-semibold">Steps</h2>
      {steps.map((s, i) => (
        <div key={i} className="space-y-1">
          <h3 className="font-semibold">
            {i + 1}. {s.title}
          </h3>
          <p className="text-muted-foreground">{s.body}</p>
          {s.warn ? <p className="font-medium text-amber-700 dark:text-amber-400">⚠ {s.warn}</p> : null}
          {(s.warns ?? []).map((w, j) => (
            <p key={j} className="font-medium text-amber-700 dark:text-amber-400">⚠ {w}</p>
          ))}
        </div>
      ))}

      <h2 className="pt-2 text-base font-semibold">How to check it worked</h2>
      <p className="text-muted-foreground">{verify}</p>
    </article>
  );
}

/** App-styled Guide / Plain-text toggle shell (replaces the `.og` GuideTabs). */
export function GuideShell({ guide, plain }: { guide: ReactNode; plain: ReactNode }) {
  const [tab, setTab] = useState<"guide" | "plain">("guide");
  return (
    <div>
      <Link
        href="/guides"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> All guides
      </Link>
      <div className="mb-6 inline-flex rounded-lg border bg-muted/40 p-0.5" role="tablist">
        {(["guide", "plain"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "guide" ? "Guide" : "Plain text"}
          </button>
        ))}
      </div>
      <div hidden={tab !== "guide"}>{guide}</div>
      <div hidden={tab !== "plain"}>{plain}</div>
    </div>
  );
}
