import Link from "next/link";
import { Plus } from "lucide-react";
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

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
import { formatCurrency } from "@/lib/money";
import { getPropertyRangeCounts } from "@/lib/queries/metrics";
import { getAppSettings } from "@/lib/settings";

export const metadata = { title: "Properties — LeadGen" };
export const dynamic = "force-dynamic";

const BILLING_LABEL: Record<string, string> = {
  flat_monthly: "Flat monthly",
  per_lead: "Per lead",
  hybrid: "Hybrid",
};

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    niche?: string;
    client?: string;
  }>;
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
  if (sp.niche) conds.push(eq(properties.niche, sp.niche));
  if (sp.client === "unassigned") conds.push(isNull(properties.clientId));
  else if (sp.client) conds.push(eq(properties.clientId, sp.client));

  const [rows, clientList, nicheRows, counts] = await Promise.all([
    db
      .select({
        property: properties,
        clientName: clients.businessName,
      })
      .from(properties)
      .leftJoin(clients, eq(clients.id, properties.clientId))
      .where(and(...conds))
      .orderBy(asc(properties.name)),
    db
      .select({ id: clients.id, businessName: clients.businessName })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.businessName)),
    db
      .selectDistinct({ niche: properties.niche })
      .from(properties)
      .where(and(isNull(properties.deletedAt), sql`${properties.niche} is not null`))
      .orderBy(asc(properties.niche)),
    getPropertyRangeCounts(trailingDayRange(tz, 30)),
  ]);

  const niches = nicheRows.map((n) => n.niche).filter((n): n is string => !!n);

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Lead gen sites we own. One property is one brand."
      >
        <PropertyDialog
          mode="create"
          clients={clientList}
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

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Niche</TableHead>
                <TableHead>City / State</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead className="text-right">30d leads</TableHead>
                <TableHead className="text-right">30d est. value</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No properties match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ property: p, clientName }) => {
                  const count = counts.get(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/properties/${p.id}`}
                          className="hover:underline"
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.domain ?? "—"}
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {p.niche ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {clientName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {BILLING_LABEL[p.billingType] ?? titleCase(p.billingType)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(count?.total ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(count?.estimatedValue ?? "0")}
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
                            gbpPlaceId: p.gbpPlaceId,
                            trackingPhone: p.trackingPhone,
                            clientId: p.clientId,
                            billingType: p.billingType,
                            monthlyRate: p.monthlyRate,
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
