import { Check, X } from "lucide-react";

import { HealthDot, MomentumArrow } from "@/components/producing-health";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PropertyProducingHealthDetail } from "@/lib/queries/producing-health";
import { cn } from "@/lib/utils";

const MOMENTUM_LABEL: Record<string, string> = {
  rising: "Rising",
  steady: "Steady",
  falling: "Falling",
  none: "No meaningful volume",
};

const SIGNAL_CALLOUT: Record<string, string> = {
  overstated:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  understated:
    "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
};

export function ProducingHealthCard({
  detail,
}: {
  detail: PropertyProducingHealthDetail;
}) {
  const { health, billable30d, monthlyBillable, months, minBillableLeads, monthsRequired } =
    detail;
  const meets30d = billable30d >= minBillableLeads;
  const meetsMonths = health.qualifyingMonths >= monthsRequired;
  const maxCount = Math.max(1, ...monthlyBillable);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Producing health
          <HealthDot signal={health.signal} reason={health.reason} />
        </CardTitle>
        <CardDescription>
          Derived from billable lead flow only (spam and junk excluded). Advisory
          — it never changes this property&rsquo;s status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Derived verdict
            </p>
            <p className="text-lg font-semibold">
              {health.derivedProducing ? "Producing" : "Not producing"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              3-month momentum
            </p>
            <p className="flex items-center gap-1.5 text-lg font-semibold">
              <MomentumArrow momentum={health.momentum} />
              {MOMENTUM_LABEL[health.momentum]}
            </p>
          </div>
        </div>

        {/* The two rules that define derived-producing. */}
        <div className="space-y-1.5 text-sm">
          <Criterion met={meets30d}>
            ≥ {minBillableLeads} billable leads in the last 30 days —{" "}
            <span className="font-medium tabular-nums">{billable30d}</span>
          </Criterion>
          <Criterion met={meetsMonths}>
            ≥ {minBillableLeads} billable in {monthsRequired} of the last 3
            complete months —{" "}
            <span className="font-medium tabular-nums">
              {health.qualifyingMonths} of 3
            </span>
          </Criterion>
        </div>

        {/* 3-month billable trend. */}
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Billable leads per month
          </p>
          <div className="flex items-end gap-3">
            {months.map((m, i) => {
              const count = monthlyBillable[i];
              const cleared = count >= minBillableLeads;
              return (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium tabular-nums">{count}</span>
                  <div className="flex h-16 w-full items-end">
                    <div
                      className={cn(
                        "w-full rounded-t",
                        cleared ? "bg-emerald-500" : "bg-muted-foreground/30",
                      )}
                      style={{
                        height: `${Math.max(6, (count / maxCount) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {m.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {health.reason && SIGNAL_CALLOUT[health.signal] ? (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              SIGNAL_CALLOUT[health.signal],
            )}
          >
            {health.reason}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Criterion({
  met,
  children,
}: {
  met: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <X className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span>{children}</span>
    </div>
  );
}
