import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, Building2, Plus } from "lucide-react";
import { and, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

import { BillableOfTotal } from "@/components/billable-of-total";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PropertiesFilters } from "@/components/properties/properties-filters";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { ConnectionDot } from "@/components/properties/connection-dot";
import { PropertyRowActions } from "@/components/properties/property-row-actions";
import { PropertyStatusBadge } from "@/components/properties/property-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currentMonthKey, trailingDayRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { clients, properties } from "@/lib/db/schema";
import { titleCase } from "@/lib/format";
import { formatCurrency, toMoneyNumber } from "@/lib/money";
import {
  getPropertyLifetimeMap,
  getZeroRateRentedPropertyIds,
} from "@/lib/queries/assignments";
import {
  getPropertyEconomicsMap,
  getPropertyRangeCounts,
} from "@/lib/queries/metrics";
import { getRealLeadMap } from "@/lib/queries/connection";
import { connectionStatus } from "@/lib/connection";
import { getAppSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata = { title: "Properties — LeadGen" };
export const dynamic = "force-dynamic";

const BILLING_LABEL: Record<string, string> = {
  flat_monthly: "Flat monthly",
  per_lead: "Per lead",
  hybrid: "Hybrid",
};

type SortKey =
  | "name"
  | "leads30"
  | "estValue30"
  | "effLead"
  | "marketLead"
  | "revPerMonth";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { orgTimezone: tz } = await getAppSettings();

  const conds: SQL[] = [isNull(properties.deletedAt)];
  if (sp.q) {
    conds.push(
      or(
        ilike(properties.name, `%${sp.q}%`),
        ilike(properties.domain, `%${sp.q}%`),
      )!,
    );
  }
  if (sp.status) conds.push(eq(properties.status, sp.status as never));
  // Simplified rental filter (matches the dashboard pipeline): rented / trial /
  // not_rented (everything else). Display-only mapping of the status enum.
  if (sp.rental === "rented") conds.push(eq(properties.status, "rented" as never));
  else if (sp.rental === "trial") conds.push(eq(properties.status, "trial" as never));
  else if (sp.rental === "not_rented")
    conds.push(sql`${properties.status} not in ('rented','trial')`);
  if (sp.niche) conds.push(eq(properties.niche, sp.niche));
  if (sp.client === "unassigned") conds.push(isNull(properties.clientId));
  else if (sp.client) conds.push(eq(properties.clientId, sp.client));

  const [rowsRaw, clientList, nicheRows, counts, lifetimeMap, econByProp, realLeadMap, zeroRateSet] =
    await Promise.all([
      db
        .select({ property: properties, clientName: clients.businessName })
        .from(properties)
        .leftJoin(clients, eq(clients.id, properties.clientId))
        .where(and(...conds)),
      db
        .select({ id: clients.id, businessName: clients.businessName })
        .from(clients)
        .where(isNull(clients.deletedAt))
        .orderBy(clients.businessName),
      db
        .selectDistinct({ niche: properties.niche })
        .from(properties)
        .where(and(isNull(properties.deletedAt), sql`${properties.niche} is not null`))
        .orderBy(properties.niche),
      getPropertyRangeCounts(trailingDayRange(tz, 30)),
      getPropertyLifetimeMap(tz),
      getPropertyEconomicsMap(tz, currentMonthKey(tz)),
      getRealLeadMap(),
      getZeroRateRentedPropertyIds(),
    ]);

  // Connection input per property: admin flag + most recent real ingested lead.
  const connFor = (p: (typeof rowsRaw)[number]["property"]) => ({
    connectionReady: p.connectionReady,
    lastRealLeadAt: realLeadMap.get(p.id) ?? null,
  });

  const niches = nicheRows.map((n) => n.niche).filter((n): n is string => !!n);

  // Value extractors for sorting. Effective $/lead is a current-calendar-month
  // figure; unrented / no-billable-leads sort to the bottom (-1 sentinel).
  const val = (pid: string, p: (typeof rowsRaw)[number]["property"], key: SortKey) => {
    switch (key) {
      case "name":
        return p.name.toLowerCase();
      case "leads30":
        return counts.get(pid)?.total ?? 0;
      case "estValue30":
        return toMoneyNumber(counts.get(pid)?.estimatedValue ?? "0");
      case "effLead":
        return econByProp.get(pid)?.effectiveValue ?? -1;
      case "marketLead":
        return econByProp.get(pid)?.marketBlended ?? 0;
      case "revPerMonth":
        return lifetimeMap.get(pid)?.revenuePerMonthRented ?? 0;
    }
  };

  const sortKey: SortKey = (["name", "leads30", "estValue30", "effLead", "marketLead", "revPerMonth"] as const).includes(
    sp.sort as SortKey,
  )
    ? (sp.sort as SortKey)
    : "revPerMonth";
  const sortDir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";

  let rows = [...rowsRaw];
  // Connection filter (derived): is the property actually receiving/ready?
  if (sp.connected === "connected" || sp.connected === "not_connected") {
    const want = sp.connected === "connected";
    rows = rows.filter((r) => connectionStatus(connFor(r.property)).connected === want);
  }
  rows.sort((a, b) => {
    const av = val(a.property.id, a.property, sortKey);
    const bv = val(b.property.id, b.property, sortKey);
    let cmp: number;
    if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv);
    else cmp = (av as number) - (bv as number);
    if (cmp === 0) cmp = a.property.name.localeCompare(b.property.name);
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Shape a property row into the value the row-actions menu expects. Shared by
  // the desktop table and the mobile card list.
  const actionsProperty = (p: (typeof rowsRaw)[number]["property"]) => ({
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
  });

  // Build a sort link that preserves current filters.
  const sortHref = (key: SortKey) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v) next.set(k, v);
    const nextDir = sortKey === key && sortDir === "desc" ? "asc" : "desc";
    next.set("sort", key);
    next.set("dir", nextDir);
    return `/properties?${next.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Lead gen sites we own. One property is one brand."
      >
        <PropertyDialog
          mode="create"
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add property
            </Button>
          }
        />
      </PageHeader>

      <div className="mb-4">
        <PropertiesFilters niches={niches} clients={clientList} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties match these filters"
          description="Adjust or clear the filters above, or add a new property to get started."
        />
      ) : (
      <>
      {/* Desktop: full table. Hidden below lg in favour of the card list. */}
      <div className="hidden rounded-lg border lg:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Name" k="name" href={sortHref("name")} active={sortKey === "name"} dir={sortDir} />
                <TableHead>Domain</TableHead>
                <TableHead>Niche</TableHead>
                <TableHead>City / State</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Billing</TableHead>
                <SortHead label="30d leads" k="leads30" href={sortHref("leads30")} active={sortKey === "leads30"} dir={sortDir} numeric />
                <SortHead label="30d est. value" k="estValue30" href={sortHref("estValue30")} active={sortKey === "estValue30"} dir={sortDir} numeric />
                <SortHead label="Eff. $/lead" k="effLead" href={sortHref("effLead")} active={sortKey === "effLead"} dir={sortDir} numeric />
                <SortHead label="Market $/lead" k="marketLead" href={sortHref("marketLead")} active={sortKey === "marketLead"} dir={sortDir} numeric />
                <SortHead label="Rev/mo rented" k="revPerMonth" href={sortHref("revPerMonth")} active={sortKey === "revPerMonth"} dir={sortDir} numeric />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-10 text-center text-muted-foreground">
                    No properties match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ property: p, clientName }) => {
                  const count = counts.get(p.id);
                  const econ = econByProp.get(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <ConnectionDot connection={connFor(p)} />
                          <Link href={`/properties/${p.id}`} className="hover:underline">
                            {p.name}
                          </Link>
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.domain ?? "—"}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{p.niche ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <PropertyStatusBadge status={p.status} />
                          {zeroRateSet.has(p.id) ? <ZeroRateFlag /> : null}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{clientName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {BILLING_LABEL[p.billingType] ?? titleCase(p.billingType)}
                      </TableCell>
                      <TableCell className="text-right">
                        <BillableOfTotal
                          billable={count?.billable ?? 0}
                          total={count?.total ?? 0}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(count?.estimatedValue ?? "0")}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          econ?.underpriced
                            ? "font-semibold text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground",
                        )}
                        title={
                          econ?.underpriced
                            ? "Effective cost per lead is well below market — a candidate to move to pay-per-lead."
                            : undefined
                        }
                      >
                        {econ?.effectiveLabel ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {econ?.marketLabel ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {lifetimeMap.get(p.id)?.summary.monthsRented
                          ? formatCurrency(lifetimeMap.get(p.id)!.revenuePerMonthRented)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <PropertyRowActions
                          property={actionsProperty(p)}
                          clients={clientList}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile/tablet: card list. Secondary columns (niche, city, billing,
          market $/lead, est. value) move behind the tap into the detail. */}
      <div className="space-y-3 lg:hidden">
        <MobileSort sortKey={sortKey} sortDir={sortDir} sortHref={sortHref} />
        {rows.length === 0 ? (
          <div className="rounded-lg border py-10 text-center text-muted-foreground">
            No properties match these filters.
          </div>
        ) : (
          rows.map(({ property: p, clientName }) => {
            const count = counts.get(p.id);
            const life = lifetimeMap.get(p.id);
            const revPerMo =
              life?.summary.monthsRented ? formatCurrency(life.revenuePerMonthRented) : "—";
            return (
              <div key={p.id} className="rounded-xl border p-4">
                <div className="flex items-start gap-2.5">
                  <ConnectionDot connection={connFor(p)} className="mt-[7px]" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/properties/${p.id}`}
                      className="block truncate py-0.5 font-medium leading-snug hover:underline"
                    >
                      {p.name}
                    </Link>
                    <div className="truncate text-sm text-muted-foreground">
                      {p.domain ?? "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <PropertyStatusBadge status={p.status} className="mt-0.5" />
                    {zeroRateSet.has(p.id) ? <ZeroRateFlag /> : null}
                  </div>
                  <PropertyRowActions
                    property={actionsProperty(p)}
                    clients={clientList}
                    triggerClassName="h-11 w-11"
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniStat label="Client" value={clientName ?? "—"} />
                  <MiniStat
                    label="30d leads"
                    value={
                      <BillableOfTotal
                        billable={count?.billable ?? 0}
                        total={count?.total ?? 0}
                      />
                    }
                  />
                  <MiniStat label="Rev/mo" value={revPerMo} numeric />
                </div>
              </div>
            );
          })
        )}
      </div>
      </>
      )}
    </div>
  );
}

/** Amber flag: rented but the active assignment bills $0 (no revenue). */
function ZeroRateFlag() {
  return (
    <span
      title="Rented at a $0 rate — no revenue is being recorded. Use Change rate to fix."
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning"
    >
      <AlertTriangle className="h-3 w-3" />
      $0 rate
    </span>
  );
}

/** A compact labelled figure inside a mobile card. */
function MiniStat({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 px-2.5 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "truncate text-sm font-medium",
          numeric && "tabular-nums",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Mobile sort control: a native select mirroring the table's sortable columns. */
function MobileSort({
  sortKey,
  sortDir,
  sortHref,
}: {
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  sortHref: (k: SortKey) => string;
}) {
  const OPTIONS: { key: SortKey; label: string }[] = [
    { key: "revPerMonth", label: "Rev/mo rented" },
    { key: "leads30", label: "30d leads" },
    { key: "estValue30", label: "30d est. value" },
    { key: "effLead", label: "Eff. $/lead" },
    { key: "marketLead", label: "Market $/lead" },
    { key: "name", label: "Name" },
  ];
  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">Sort</span>
      {OPTIONS.map((o) => (
        <Link
          key={o.key}
          href={sortHref(o.key)}
          className={cn(
            "inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs",
            o.key === sortKey
              ? "border-foreground/30 bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {o.label}
          {o.key === sortKey ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function SortHead({
  label,
  href,
  active,
  dir,
  numeric = false,
}: {
  label: string;
  k: SortKey;
  href: string;
  active: boolean;
  dir: "asc" | "desc";
  numeric?: boolean;
}) {
  return (
    <TableHead className={numeric ? "text-right" : undefined}>
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          numeric && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : null}
      </Link>
    </TableHead>
  );
}
