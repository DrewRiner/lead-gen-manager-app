import Link from "next/link";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { and, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

import { PageHeader } from "@/components/page-header";
import { PropertiesFilters } from "@/components/properties/properties-filters";
import { PropertyDialog } from "@/components/properties/property-dialog";
import { PropertyRowActions } from "@/components/properties/property-row-actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trailingDayRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { clients, properties } from "@/lib/db/schema";
import { formatNumber, titleCase } from "@/lib/format";
import { formatCurrency, toMoneyNumber } from "@/lib/money";
import { getPropertyLifetimeMap } from "@/lib/queries/assignments";
import { getPropertyRangeCounts } from "@/lib/queries/metrics";
import { getReviewFlags } from "@/lib/queries/pipeline";
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
  | "targetRent"
  | "leads30"
  | "estValue30"
  | "revPerMonth";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { orgTimezone: tz } = await getAppSettings();
  const review = sp.review === "1";

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
  if (sp.niche) conds.push(eq(properties.niche, sp.niche));
  if (sp.client === "unassigned") conds.push(isNull(properties.clientId));
  else if (sp.client) conds.push(eq(properties.clientId, sp.client));

  const [rowsRaw, clientList, nicheRows, counts, lifetimeMap, reviewFlags] =
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
      getReviewFlags(tz),
    ]);

  const niches = nicheRows.map((n) => n.niche).filter((n): n is string => !!n);

  // Value extractors for sorting.
  const val = (pid: string, p: (typeof rowsRaw)[number]["property"], key: SortKey) => {
    switch (key) {
      case "name":
        return p.name.toLowerCase();
      case "targetRent":
        return toMoneyNumber(p.targetMonthlyRent);
      case "leads30":
        return counts.get(pid)?.total ?? 0;
      case "estValue30":
        return toMoneyNumber(counts.get(pid)?.estimatedValue ?? "0");
      case "revPerMonth":
        return lifetimeMap.get(pid)?.revenuePerMonthRented ?? 0;
    }
  };

  const sortKey: SortKey = (["name", "targetRent", "leads30", "estValue30", "revPerMonth"] as const).includes(
    sp.sort as SortKey,
  )
    ? (sp.sort as SortKey)
    : "revPerMonth";
  const sortDir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";

  let rows = [...rowsRaw];
  if (review) rows = rows.filter((r) => reviewFlags.has(r.property.id));
  rows.sort((a, b) => {
    const av = val(a.property.id, a.property, sortKey);
    const bv = val(b.property.id, b.property, sortKey);
    let cmp: number;
    if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv);
    else cmp = (av as number) - (bv as number);
    if (cmp === 0) cmp = a.property.name.localeCompare(b.property.name);
    return sortDir === "asc" ? cmp : -cmp;
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

      {review ? (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Showing {formatNumber(rows.length)} propert
          {rows.length === 1 ? "y" : "ies"} that need a status review.
          <Link href="/properties" className="ml-auto font-medium underline">
            Clear
          </Link>
        </div>
      ) : (
        <div className="mb-4">
          <PropertiesFilters niches={niches} clients={clientList} />
        </div>
      )}

      <div className="rounded-lg border">
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
                <SortHead label="Target rent" k="targetRent" href={sortHref("targetRent")} active={sortKey === "targetRent"} dir={sortDir} numeric />
                <SortHead label="30d leads" k="leads30" href={sortHref("leads30")} active={sortKey === "leads30"} dir={sortDir} numeric />
                <SortHead label="30d est. value" k="estValue30" href={sortHref("estValue30")} active={sortKey === "estValue30"} dir={sortDir} numeric />
                <SortHead label="Rev/mo rented" k="revPerMonth" href={sortHref("revPerMonth")} active={sortKey === "revPerMonth"} dir={sortDir} numeric />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                    {review
                      ? "No properties need a status review."
                      : "No properties match these filters."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ property: p, clientName }) => {
                  const count = counts.get(p.id);
                  const flag = reviewFlags.get(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link href={`/properties/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.domain ?? "—"}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{p.niche ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={p.status} />
                          {flag ? (
                            <span
                              title={flag.reason}
                              className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                            >
                              {flag.badge}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{clientName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {BILLING_LABEL[p.billingType] ?? titleCase(p.billingType)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(p.targetMonthlyRent)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(count?.total ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(count?.estimatedValue ?? "0")}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {lifetimeMap.get(p.id)?.summary.monthsRented
                          ? formatCurrency(lifetimeMap.get(p.id)!.revenuePerMonthRented)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <PropertyRowActions
                          property={{
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
                          }}
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
