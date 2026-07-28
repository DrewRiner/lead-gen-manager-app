import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, UserMinus, UserPlus } from "lucide-react";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { LeadsTable } from "@/components/leads/leads-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { AssignClientDialog } from "@/components/properties/assign-client-dialog";
import { ChangeRateDialog } from "@/components/properties/change-rate-dialog";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { RecalcEstimatedValuesButton } from "@/components/properties/recalc-button";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
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
import { unassignClient } from "@/lib/actions/assignments";
import {
  daysBetween,
  localDateStr,
  nowLocalInputValue,
  recentMonths,
  todayDateStr,
  trailingDayRange,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { clients, leads, properties, propertyAssignments } from "@/lib/db/schema";
import { formatNumber, titleCase } from "@/lib/format";
import { formatCurrency } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { getPropertyLifetime } from "@/lib/queries/assignments";
import { getLeads } from "@/lib/queries/leads";
import {
  getPropertyMonthlySeries,
  getRangeMetrics,
  type RangeMetrics,
} from "@/lib/queries/metrics";
import { getAppSettings } from "@/lib/settings";

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

  const [row] = await db
    .select({ property: properties, clientName: clients.businessName })
    .from(properties)
    .leftJoin(clients, eq(clients.id, properties.clientId))
    .where(and(eq(properties.id, id), isNull(properties.deletedAt)))
    .limit(1);

  if (!row) notFound();
  const p = row.property;

  const page = Math.max(1, Number(sp.page) || 1);

  const [
    today,
    week,
    month,
    monthly,
    lifetime,
    leadCountRow,
    leadsPage,
    clientList,
    activeAssignmentRow,
  ] = await Promise.all([
    getRangeMetrics(trailingDayRange(tz, 1), { propertyId: id }),
    getRangeMetrics(trailingDayRange(tz, 7), { propertyId: id }),
    getRangeMetrics(trailingDayRange(tz, 30), { propertyId: id }),
    getPropertyMonthlySeries(tz, id, recentMonths(tz, 12)),
    getPropertyLifetime(tz, id),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.propertyId, id), isNull(leads.deletedAt))),
    getLeads(
      tz,
      {
        propertyId: id,
        type: sp.type,
        source: sp.source,
        billableStatus: sp.billableStatus,
        deliveryStatus: sp.deliveryStatus,
        from: sp.from,
        to: sp.to,
        q: sp.q,
      },
      page,
      25,
    ),
    db
      .select({ id: clients.id, businessName: clients.businessName })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.businessName)),
    db
      .select({
        billingType: propertyAssignments.billingType,
        monthlyRate: propertyAssignments.monthlyRate,
        perLeadCallRate: propertyAssignments.perLeadCallRate,
        perLeadFormRate: propertyAssignments.perLeadFormRate,
      })
      .from(propertyAssignments)
      .where(
        and(
          eq(propertyAssignments.propertyId, id),
          isNull(propertyAssignments.endedOn),
        ),
      )
      .limit(1),
  ]);

  const totalLeadCount = leadCountRow[0]?.count ?? 0;
  const monthlyDesc = [...monthly].reverse();
  const isAssigned = p.clientId != null;
  const activeAssignment = activeAssignmentRow[0];
  const s = lifetime.summary;

  // Timeline metrics (shown only when the data exists).
  const launched = p.launchedOn;
  const daysToFirstLead =
    launched && lifetime.firstLeadAt
      ? daysBetween(launched, localDateStr(lifetime.firstLeadAt, tz))
      : null;
  const daysToFirstRental =
    launched && lifetime.firstAssignmentStartedOn
      ? daysBetween(launched, lifetime.firstAssignmentStartedOn)
      : null;

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

      <PageHeader title={p.name} description={p.domain ?? undefined}>
        <PropertyDialog
          mode="edit"
          property={editValue}
          trigger={<Button variant="outline">Edit property</Button>}
        />
        <AssignClientDialog
          propertyId={p.id}
          currentClientId={p.clientId}
          clients={clientList}
          trigger={
            <Button variant="outline">
              <UserPlus className="mr-2 h-4 w-4" />
              {isAssigned ? "Reassign" : "Assign client"}
            </Button>
          }
        />
        {isAssigned && activeAssignment ? (
          <ChangeRateDialog
            propertyId={p.id}
            active={activeAssignment}
            defaultEffectiveDate={todayDateStr(tz)}
            clientName={row.clientName}
            trigger={<Button variant="outline">Change rate</Button>}
          />
        ) : null}
        {isAssigned ? (
          <ConfirmDialog
            title="Unassign client?"
            description="Ends the active assignment as of today and marks the property unassigned. Historical revenue is preserved."
            confirmLabel="Unassign"
            action={unassignClient.bind(null, p.id)}
            trigger={
              <Button variant="outline">
                <UserMinus className="mr-2 h-4 w-4" />
                Unassign
              </Button>
            }
          />
        ) : null}
        <RecalcEstimatedValuesButton
          propertyId={p.id}
          leadCount={totalLeadCount}
        />
      </PageHeader>

      {/* Property info */}
      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-4 p-6 text-sm md:grid-cols-4">
          <Info label="Status">
            <StatusBadge status={p.status} />
          </Info>
          <Info label="Niche">
            <span className="capitalize">{p.niche ?? "—"}</span>
          </Info>
          <Info label="City / State">
            {[p.city, p.state].filter(Boolean).join(", ") || "—"}
          </Info>
          <Info label="Current client">
            {row.clientName ?? "Unassigned"}
          </Info>
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

      {/* Lifetime (all clients that ever rented it + all lead revenue) */}
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
          value={
            s.longestTenure
              ? `${s.longestTenure.months} mo`
              : "—"
          }
          hint={s.longestTenure?.clientName ?? undefined}
        />
        <StatCard
          label="Months rented"
          value={formatNumber(s.monthsRented)}
        />
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

      {/* Client history */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Client history</CardTitle>
          <CardDescription>
            Every client that ever rented this property, ranked by attributed
            revenue.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
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
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Never rented.
                    </TableCell>
                  </TableRow>
                ) : (
                  lifetime.clientHistory.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/clients/${c.clientId}`}
                          className="hover:underline"
                        >
                          {c.clientName ?? "—"}
                        </Link>
                        {c.isActive ? (
                          <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            active
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.firstStarted}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.lastEnded ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.tenureMonths} mo
                      </TableCell>
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
        </CardContent>
      </Card>

      {/* Recent-window stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <PeriodCard label="Today" m={today} />
        <PeriodCard label="Last 7 Days" m={week} />
        <PeriodCard label="Last 30 Days" m={month} />
      </div>

      {/* Billing config summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Billing configuration</CardTitle>
          <CardDescription>
            Current property defaults (used for new assignments). The active
            client keeps the rate snapshotted on their assignment — use Change
            rate to reprice them.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Info label="Billing type">
            {BILLING_LABEL[p.billingType] ?? titleCase(p.billingType)}
          </Info>
          <Info label="Monthly rate">{formatCurrency(p.monthlyRate)}</Info>
          <Info label="Per-lead call rate">
            {formatCurrency(p.perLeadCallRate)}
          </Info>
          <Info label="Per-lead form rate">
            {formatCurrency(p.perLeadFormRate)}
          </Info>
          <Info label="Call threshold">{p.billableThresholdSeconds}s</Info>
          <Info label="Est. call value">
            {formatCurrency(p.estimatedCallValue)}
          </Info>
          <Info label="Est. form value">
            {formatCurrency(p.estimatedFormValue)}
          </Info>
        </CardContent>
      </Card>

      {/* Monthly performance */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monthly performance</CardTitle>
          <CardDescription>
            Last 12 calendar months in {tz}. Flat revenue reflects the
            assignment active each month.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
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
                    <TableCell className="font-medium">
                      {m.month.label}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(m.calls)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(m.forms)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(m.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(m.billable)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(m.estimatedValue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(m.actualRevenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(m.gap)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Leads */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Leads</CardTitle>
            <CardDescription>
              {formatNumber(totalLeadCount)} total
            </CardDescription>
          </div>
          <AddLeadDialog
            properties={[{ id: p.id, name: p.name }]}
            defaultPropertyId={p.id}
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
          <LeadsFilters />
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

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="font-medium">{children}</div>
    </div>
  );
}

function PeriodCard({ label, m }: { label: string; m: RangeMetrics }) {
  return (
    <StatCard
      label={label}
      value={`${formatNumber(m.totalLeads)} leads`}
      hint={
        <span className="flex flex-col gap-0.5">
          <span>
            {formatNumber(m.calls)} calls · {formatNumber(m.forms)} forms ·{" "}
            {formatNumber(m.billable)} billable
          </span>
          <span>
            Est. {formatCurrency(m.estimatedValue)} · Rev.{" "}
            {formatCurrency(m.actualRevenue)}
          </span>
        </span>
      }
    />
  );
}
