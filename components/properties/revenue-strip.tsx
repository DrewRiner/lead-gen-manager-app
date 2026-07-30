import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";

// Compact revenue/rental analytics strip, shown ONLY for a property with an
// active assignment (rented or trial). Sits between the identity card and the
// tabs. One scannable row — not a second dashboard. All figures come from the
// existing revenue / economics queries; nothing is recomputed here.

const BILLING_LABEL: Record<string, string> = {
  flat_monthly: "Flat monthly",
  per_lead: "Per lead",
  hybrid: "Hybrid",
};

export interface RevenueStripProps {
  clientName: string | null;
  billingType: string;
  monthlyRate: string;
  perLeadCallRate: string;
  perLeadFormRate: string;
  isTrial: boolean;
  /** Flat rent booked this month + per-lead billed this month (calendar month). */
  revenueThisMonth: string;
  lifetimeRevenue: string;
  /** Your actual cost per lead this month (null when no billable leads). */
  actualPerLead: number | null;
  /** Blended market rate per lead this month. */
  marketPerLead: number;
  underpriced: boolean;
  /** Trial only: days until the trial ends (may be negative if expired). */
  daysRemaining: number | null;
  expired: boolean;
}

function perLeadRateLabel(call: string, form: string): string {
  const c = formatCurrency(call);
  const f = formatCurrency(form);
  return call === form ? `${c}/lead` : `${c}/call · ${f}/form`;
}

export function RevenueStrip(props: RevenueStripProps) {
  const {
    clientName,
    billingType,
    monthlyRate,
    perLeadCallRate,
    perLeadFormRate,
    isTrial,
    revenueThisMonth,
    lifetimeRevenue,
    actualPerLead,
    marketPerLead,
    underpriced,
    daysRemaining,
    expired,
  } = props;

  const billingLabel = BILLING_LABEL[billingType] ?? billingType;
  const isPerLead = billingType === "per_lead";
  const gap = actualPerLead != null ? marketPerLead - actualPerLead : null;

  return (
    <Card className="mb-6">
      <CardContent className="flex flex-wrap items-stretch gap-x-6 gap-y-4 p-4 sm:p-5">
        <Field label="Client">
          <div className="truncate font-semibold">{clientName ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {isTrial ? "Free trial" : billingLabel}
          </div>
        </Field>

        <Divider />

        {isTrial ? (
          <Field label="Trial">
            <div className="font-semibold">Booking $0</div>
            <div
              className={cn(
                "text-xs",
                expired ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground",
              )}
            >
              {expired
                ? "Trial expired"
                : daysRemaining != null
                  ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`
                  : "In progress"}
            </div>
          </Field>
        ) : (
          <Field label={isPerLead ? "Per-lead rate" : "Monthly rate"}>
            <div className="font-semibold tabular-nums">
              {isPerLead
                ? perLeadRateLabel(perLeadCallRate, perLeadFormRate)
                : formatCurrency(monthlyRate)}
            </div>
          </Field>
        )}

        <Divider />

        <Field label="Revenue this month">
          <div className="font-semibold tabular-nums">{formatCurrency(revenueThisMonth)}</div>
        </Field>

        <Divider />

        <Field label="Lifetime revenue">
          <div className="font-semibold tabular-nums">{formatCurrency(lifetimeRevenue)}</div>
        </Field>

        {/* Cost-per-lead vs market — the strategically important pair, weighted. */}
        <div
          className={cn(
            "ml-auto flex items-center gap-4 rounded-lg border px-4 py-2",
            underpriced
              ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
              : "bg-muted/40",
          )}
        >
          <div>
            <p
              className="text-xs uppercase tracking-wide text-muted-foreground"
              title="What the client effectively pays per billable lead this month"
            >
              Your actual cost/lead
            </p>
            <div className="text-xl font-bold tabular-nums">
              {actualPerLead != null ? `${formatCurrency(actualPerLead)}/lead` : "—"}
            </div>
          </div>
          <div className="border-l pl-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Market</p>
            <div className="text-sm font-medium tabular-nums">
              {formatCurrency(marketPerLead)}/lead
            </div>
            {gap != null ? (
              <div
                className={cn(
                  "text-xs tabular-nums",
                  underpriced
                    ? "font-semibold text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
                )}
              >
                Gap {gap >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(gap))}
                {underpriced ? " · underpriced" : ""}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="hidden w-px self-stretch bg-border sm:block" />;
}
