import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { MetricCard } from "@/components/dashboard/metric-card";
import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { LeadTypeChips } from "@/components/leads/lead-type-chips";
import { LeadsTable } from "@/components/leads/leads-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { ConnectionDot } from "@/components/properties/connection-dot";
import { CostPerLead } from "@/components/properties/cost-per-lead";
import { PropertyActionsMenu } from "@/components/properties/property-actions-menu";
import { PropertyStatusBadge } from "@/components/properties/property-status-badge";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { TrialBanner } from "@/components/properties/trial-banner";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  comparativeCalendarWindow,
  daysBetween,
  localDateStr,
  nowLocalInputValue,
  recentMonths,
  todayDateStr,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { clients, leads, properties, propertyAssignments } from "@/lib/db/schema";
import { formatNumber, titleCase } from "@/lib/format";
import { formatCurrency } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { getRealLeadAt } from "@/lib/queries/connection";
import { getPropertyLifetime } from "@/lib/queries/assignments";
import { getLeadTypeCounts, getLeads } from "@/lib/queries/leads";
import {
  getPropertyCostPerLead,
  getPropertyMonthlySeries,
  getRangeMetrics,
} from "@/lib/queries/metrics";
import { getAppSettings } from "@/lib/settings";
import { TabLink, TabNav } from "@/components/tab-link";

export const dynamic = "force-dynamic";

const BILLING_LABEL: Record<string, string> = {
  flat_monthly: "Flat monthly",
  per_lead: "Per lead",
  hybrid: "Hybrid",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { orgTimezone: tz } = await getAppSettings();
  const tab = sp.tab === "lifetime" ? "lifetime" : "activity";

  const [row] = await db
    .select({ property: properties, clientName: clients.businessName })
    .from(properties)
    .leftJoin(clients, eq(clients.id, properties.clientId))
    .where(and(eq(properties.id, id), isNull(properties.deletedAt)))
    .limit(1);
  if (!row) notFound();
  const p = row.property;

  // Always needed: header actions (assign/change-rate/recalc), lead count, and
  // the most recent real ingested lead (for the connection dot).
  const [clientList, activeAssignmentRow, leadCountRow, realLeadAt] = await Promise.all([
    db
      .select({ id: clients.id, businessName: clients.businessName })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.businessName)),
    db
      .select({
        id: propertyAssignments.id,
        clientId: propertyAssignments.clientId,
        startedOn: propertyAssignments.startedOn,
        billingType: propertyAssignments.billingType,
        monthlyRate: propertyAssignments.monthlyRate,
        perLeadCallRate: propertyAssignments.perLeadCallRate,
        perLeadFormRate: propertyAssignments.perLeadFormRate,
        isTrial: propertyAssignments.isTrial,
        trialEndsOn: propertyAssignments.trialEndsOn,
      })
      .from(propertyAssignments)
      .where(
        and(
          eq(propertyAssignments.propertyId, id),
          isNull(propertyAssignments.endedOn),
        ),
      )
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.propertyId, id), isNull(leads.deletedAt))),
    getRealLeadAt(id),
  ]);

  const totalLeadCount = leadCountRow[0]?.count ?? 0;
  const connection = { connectionReady: p.connectionReady, lastRealLeadAt: realLeadAt };
  const activeAssignment = activeAssignmentRow[0];
  const onTrial = p.status === "trial" && activeAssignment?.isTrial === true;
  const isAssigned = p.clientId != null && !onTrial;
  const today = todayDateStr(tz);

  // Trial banner metrics (only when on a trial).
  let trial: {
    assignmentId: string;
    dayN: number;
    dayM: number;
    daysRemaining: number;
    expired: boolean;
    leadsDelivered: number;
    estimatedDelivered: string;
  } | null = null;
  if (onTrial && activeAssignment?.trialEndsOn) {
    const [delivered] = await db
      .select({
        n: sql<number>`count(*)::int`,
        est: sql<string>`coalesce(sum(${leads.estimatedValue}), 0)::text`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.propertyId, id),
          eq(leads.clientId, activeAssignment.clientId),
          isNull(leads.deletedAt),
          sql`${leads.occurredAt} >= (${activeAssignment.startedOn}::timestamp AT TIME ZONE ${tz})`,
        ),
      );
    trial = {
      assignmentId: activeAssignment.id,
      dayN: daysBetween(activeAssignment.startedOn, today) + 1,
      dayM: daysBetween(activeAssignment.startedOn, activeAssignment.trialEndsOn) + 1,
      daysRemaining: daysBetween(today, activeAssignment.trialEndsOn),
      expired: today > activeAssignment.trialEndsOn,
      leadsDelivered: delivered?.n ?? 0,
      estimatedDelivered: delivered?.est ?? "0.00",
    };
  }

  const editValue = {
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    domain: p.domain,
    niche: p.niche,
    city: p.city,
    state: p.state,
    status: p.status,
    launchedOn: p.launchedOn,
    gbpPlaceId: p.gbpPlaceId,
    trackingPhone: p.trackingPhone,
    ghlLeadSource: p.ghlLeadSource,
    ghlFormId: p.ghlFormId,
    shortCode: p.shortCode,
    clientId: p.clientId,
    billingType: p.billingType,
    monthlyRate: p.monthlyRate,
    targetMonthlyRent: p.targetMonthlyRent,
    perLeadCallRate: p.perLeadCallRate,
    perLeadFormRate: p.perLeadFormRate,
    estimatedCallValue: p.estimatedCallValue,
    estimatedFormValue: p.estimatedFormValue,
    billableThresholdSeconds: p.billableThresholdSeconds,
    notes: p.notes,
  };

  return (
    <div>
      <Link
        href="/properties"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Properties
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ConnectionDot connection={connection} className="h-3 w-3" />
            {p.name}
          </span>
        }
        description={p.domain ?? undefined}
      >
        <PropertyDialog
          mode="edit"
          property={editValue}
          trigger={<Button variant="outline">Edit property</Button>}
        />
        <PropertyActionsMenu
          propertyId={p.id}
          clientId={p.clientId}
          clientName={row.clientName}
          clients={clientList}
          isAssigned={isAssigned}
          onTrial={onTrial}
          activeAssignment={activeAssignment}
          connectionReady={p.connectionReady}
          leadCount={totalLeadCount}
          today={today}
        />
      </PageHeader>

      {onTrial && trial ? (
        <TrialBanner
          assignmentId={trial.assignmentId}
          prospectName={row.clientName ?? "Prospect"}
          dayN={trial.dayN}
          dayM={trial.dayM}
          daysRemaining={trial.daysRemaining}
          expired={trial.expired}
          leadsDelivered={trial.leadsDelivered}
          estimatedDelivered={trial.estimatedDelivered}
          targetMonthlyRent={p.targetMonthlyRent}
          today={today}
        />
      ) : null}

      {/* Identity — always visible above the tabs */}
      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-4 p-6 text-sm md:grid-cols-4">
          <Info label="Status">
            <PropertyStatusBadge status={p.status} />
          </Info>
          <Info label="Niche">
            <span className="capitalize">{p.niche ?? "—"}</span>
          </Info>
          <Info label="City / State">
            {[p.city, p.state].filter(Boolean).join(", ") || "—"}
          </Info>
          <Info label="Current client">{row.clientName ?? "Unassigned"}</Info>
          <Info label="Tracking phone">{formatPhone(p.trackingPhone)}</Info>
          <Info label="GBP place ID">{p.gbpPlaceId ?? "—"}</Info>
          <Info label="Domain">
            {p.domain ? (
              <a
                href={`https://${p.domain}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {p.domain}
              </a>
            ) : (
              "—"
            )}
          </Info>
          <Info label="Display name">{p.displayName ?? "—"}</Info>
        </CardContent>
      </Card>

      {/* Tabs (server-rendered via ?tab=) */}
      <TabNav>
        <TabLink href={`/properties/${id}?tab=activity`} active={tab === "activity"}>
          Activity
        </TabLink>
        <TabLink href={`/properties/${id}?tab=lifetime`} active={tab === "lifetime"}>
          Lifetime
        </TabLink>
      </TabNav>

      {tab === "activity" ? (
        <ActivityTab
          propertyId={id}
          property={p}
          tz={tz}
          sp={sp}
          totalLeadCount={totalLeadCount}
        />
      ) : (
        <LifetimeTab propertyId={id} property={p} tz={tz} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity tab — calendar-period metrics + billing config + leads table.
// ---------------------------------------------------------------------------

async function ActivityTab({
  propertyId,
  property: p,
  tz,
  sp,
  totalLeadCount,
}: {
  propertyId: string;
  property: typeof properties.$inferSelect;
  tz: string;
  sp: Record<string, string | undefined>;
  totalLeadCount: number;
}) {
  const page = Math.max(1, Number(sp.page) || 1);
  const dayW = comparativeCalendarWindow("day", tz);
  const weekW = comparativeCalendarWindow("week", tz);
  const monthW = comparativeCalendarWindow("month", tz);
  const opts = { propertyId };

  // Shared filter scope for both the list and the type-split counts. The counts
  // helper ignores `type` so the split stays visible while the chips filter.
  const leadFilters = {
    propertyId,
    type: sp.type,
    source: sp.source,
    billableStatus: sp.billableStatus,
    deliveryStatus: sp.deliveryStatus,
    from: sp.from,
    to: sp.to,
    q: sp.q,
  };

  const [
    todayCur,
    todayPrev,
    weekCur,
    weekPrev,
    monthCur,
    monthPrev,
    leadsPage,
    typeCounts,
  ] = await Promise.all([
    getRangeMetrics(dayW.current, opts),
    getRangeMetrics(dayW.previous, opts),
    getRangeMetrics(weekW.current, opts),
    getRangeMetrics(weekW.previous, opts),
    getRangeMetrics(monthW.current, opts),
    getRangeMetrics(monthW.previous, opts),
    getLeads(tz, leadFilters, page, 25),
    getLeadTypeCounts(tz, leadFilters),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Today"
          comparisonLabel="vs same weekday last week"
          current={todayCur}
          previous={todayPrev}
        />
        <MetricCard
          title="This week"
          comparisonLabel="vs same days last week"
          current={weekCur}
          previous={weekPrev}
        />
        <MetricCard
          title="This month"
          comparisonLabel="vs same period last month"
          current={monthCur}
          previous={monthPrev}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing configuration</CardTitle>
          <CardDescription>
            Current property defaults. The active client keeps the rate
            snapshotted on their assignment — use Change rate to reprice.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Info label="Billing type">
            {BILLING_LABEL[p.billingType] ?? titleCase(p.billingType)}
          </Info>
          <Info label="Monthly rate">{formatCurrency(p.monthlyRate)}</Info>
          <Info label="Target rent">{formatCurrency(p.targetMonthlyRent)}</Info>
          <Info label="Per-lead call">{formatCurrency(p.perLeadCallRate)}</Info>
          <Info label="Per-lead form">{formatCurrency(p.perLeadFormRate)}</Info>
          <Info label="Call threshold">{p.billableThresholdSeconds}s</Info>
          <Info label="Est. call value">
            {formatCurrency(p.estimatedCallValue)}
          </Info>
          <Info label="Est. form value">
            {formatCurrency(p.estimatedFormValue)}
          </Info>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Leads</CardTitle>
            <CardDescription>{formatNumber(totalLeadCount)} total</CardDescription>
          </div>
          <AddLeadDialog
            properties={[{ id: propertyId, name: p.name }]}
            defaultPropertyId={propertyId}
            defaultOccurredAt={nowLocalInputValue(tz)}
            tzLabel={tz}
            trigger={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> Add lead
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <LeadTypeChips
            total={typeCounts.total}
            calls={typeCounts.calls}
            forms={typeCounts.forms}
          />
          <LeadsFilters hideType />
          <LeadsTable rows={leadsPage.rows} tz={tz} hideProperty />
          <Pagination
            page={leadsPage.page}
            pageCount={leadsPage.pageCount}
            total={leadsPage.total}
            pageSize={leadsPage.pageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lifetime tab — all clients / all leads, client history, monthly, timeline.
// ---------------------------------------------------------------------------

async function LifetimeTab({
  propertyId,
  property: p,
  tz,
}: {
  propertyId: string;
  property: typeof properties.$inferSelect;
  tz: string;
}) {
  const [lifetime, monthly, costPerLead] = await Promise.all([
    getPropertyLifetime(tz, propertyId),
    getPropertyMonthlySeries(tz, propertyId, recentMonths(tz, 12)),
    getPropertyCostPerLead(tz, propertyId),
  ]);
  const s = lifetime.summary;
  const monthlyDesc = [...monthly].reverse();

  const launched = p.launchedOn;
  const daysToFirstLead =
    launched && lifetime.firstLeadAt
      ? daysBetween(launched, localDateStr(lifetime.firstLeadAt, tz))
      : null;
  const daysToFirstRental =
    launched && lifetime.firstAssignmentStartedOn
      ? daysBetween(launched, lifetime.firstAssignmentStartedOn)
      : null;

  return (
    <div>
      <CostPerLead data={costPerLead} />

      <div className="mb-2 text-sm font-medium text-muted-foreground">
        Lifetime — all clients, all leads
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue / month rented"
          value={formatCurrency(lifetime.revenuePerMonthRented)}
          hint="The comparable earning rate between properties"
        />
        <StatCard
          label="Lifetime revenue"
          value={formatCurrency(lifetime.lifetimeRevenue)}
          hint={`Flat rent + ${formatCurrency(lifetime.leadRevenue)} per-lead`}
        />
        <StatCard
          label="Lifetime estimated value"
          value={formatCurrency(lifetime.lifetimeEstimatedValue)}
          hint={`${formatNumber(lifetime.totalLeads)} leads, any client`}
        />
        <StatCard
          label="Occupancy"
          value={pct(s.occupancyRate)}
          hint={`${s.monthsRented} of ${s.monthsSinceStart} months rented`}
        />
        <StatCard
          label="Total clients"
          value={formatNumber(s.totalClients)}
          hint="Distinct clients ever rented"
        />
        <StatCard
          label="Avg tenure / client"
          value={`${s.averageTenureMonths.toFixed(1)} mo`}
        />
        <StatCard
          label="Longest tenure"
          value={s.longestTenure ? `${s.longestTenure.months} mo` : "—"}
          hint={s.longestTenure?.clientName ?? undefined}
        />
        <StatCard label="Months rented" value={formatNumber(s.monthsRented)} />
        <StatCard
          label="Launch → first lead"
          value={daysToFirstLead != null ? `${daysToFirstLead} days` : "—"}
          hint={p.launchedOn ? undefined : "No launch date set"}
        />
        <StatCard
          label="Launch → first rental"
          value={daysToFirstRental != null ? `${daysToFirstRental} days` : "—"}
          hint={p.launchedOn ? undefined : "No launch date set"}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Client history</CardTitle>
          <CardDescription>
            Every client that ever rented this property, ranked by attributed
            revenue.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead className="text-right">Tenure</TableHead>
                  <TableHead className="text-right">Attributed revenue</TableHead>
                  <TableHead className="text-right">% of lifetime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lifetime.clientHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Never rented.
                    </TableCell>
                  </TableRow>
                ) : (
                  lifetime.clientHistory.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell className="font-medium">
                        <Link href={`/clients/${c.clientId}`} className="hover:underline">
                          {c.clientName ?? "—"}
                        </Link>
                        {c.isActive ? (
                          <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            active
                          </span>
                        ) : null}
                        {c.hasTrial ? (
                          <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                            Trial
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.firstStarted}</TableCell>
                      <TableCell className="text-muted-foreground">{c.lastEnded ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.tenureMonths} mo</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(c.attributedRevenue)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Math.round(c.pctOfLifetimeRevenue)}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile/tablet: card list. */}
          <div className="space-y-3 px-4 lg:hidden">
            {lifetime.clientHistory.length === 0 ? (
              <div className="rounded-lg border py-8 text-center text-muted-foreground">
                Never rented.
              </div>
            ) : (
              lifetime.clientHistory.map((c) => (
                <div key={c.clientId} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/clients/${c.clientId}`}
                      className="min-w-0 truncate py-0.5 font-medium leading-snug hover:underline"
                    >
                      {c.clientName ?? "—"}
                    </Link>
                    <div className="flex shrink-0 gap-1">
                      {c.isActive ? (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                          active
                        </span>
                      ) : null}
                      {c.hasTrial ? (
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                          Trial
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.firstStarted} → {c.lastEnded ?? "active"} · {c.tenureMonths} mo
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <CardStat label="Attributed revenue" value={formatCurrency(c.attributedRevenue)} />
                    <CardStat label="% of lifetime" value={`${Math.round(c.pctOfLifetimeRevenue)}%`} />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly performance</CardTitle>
          <CardDescription>
            Last 12 calendar months in {tz}. Flat revenue reflects the assignment
            active each month.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Forms</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Billable</TableHead>
                  <TableHead className="text-right">Est. value</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyDesc.map((m) => (
                  <TableRow key={m.month.key}>
                    <TableCell className="font-medium">{m.month.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.calls)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.forms)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.billable)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.estimatedValue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.actualRevenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(m.gap)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile/tablet: card list. */}
          <div className="space-y-3 px-4 lg:hidden">
            {monthlyDesc.map((m) => (
              <div key={m.month.key} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{m.month.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatNumber(m.total)} leads
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <CardStat label="Calls" value={formatNumber(m.calls)} />
                  <CardStat label="Forms" value={formatNumber(m.forms)} />
                  <CardStat label="Billable" value={formatNumber(m.billable)} />
                  <CardStat label="Est. value" value={formatCurrency(m.estimatedValue)} />
                  <CardStat label="Revenue" value={formatCurrency(m.actualRevenue)} />
                  <CardStat label="Gap" value={formatCurrency(m.gap)} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 px-2.5 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="font-medium">{children}</div>
    </div>
  );
}
