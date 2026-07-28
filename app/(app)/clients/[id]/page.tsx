import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, asc, eq, isNull } from "drizzle-orm";

import { ClientDialog } from "@/components/clients/client-dialog";
import { PageHeader } from "@/components/page-header";
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
import { trailingDayRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { clients, properties } from "@/lib/db/schema";
import { formatNumber, titleCase } from "@/lib/format";
import { formatCurrency, sumMoney, toMoneyNumber } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { getClientLifetime } from "@/lib/queries/assignments";
import { getPropertyRangeCounts, getRangeMetrics } from "@/lib/queries/metrics";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const BILLING_LABEL: Record<string, string> = {
  flat_monthly: "Flat monthly",
  per_lead: "Per lead",
  hybrid: "Hybrid",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { orgTimezone: tz } = await getAppSettings();

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
    .limit(1);
  if (!client) notFound();

  const range = trailingDayRange(tz, 30);

  const [props, metrics, counts, lifetime] = await Promise.all([
    db
      .select()
      .from(properties)
      .where(and(eq(properties.clientId, id), isNull(properties.deletedAt)))
      .orderBy(asc(properties.name)),
    getRangeMetrics(range, { clientId: id }),
    getPropertyRangeCounts(range),
    getClientLifetime(tz, id),
  ]);

  const gap = sumMoney([
    metrics.estimatedValue,
    -toMoneyNumber(metrics.actualRevenue),
  ]);

  // Monthly recurring rent across flat/hybrid properties this client holds.
  const monthlyRecurring = sumMoney(
    props
      .filter(
        (p) =>
          p.billingType === "flat_monthly" || p.billingType === "hybrid",
      )
      .map((p) => p.monthlyRate),
  );

  return (
    <div>
      <Link
        href="/clients"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Clients
      </Link>

      <PageHeader title={client.businessName} description={client.contactName ?? undefined}>
        <ClientDialog
          mode="edit"
          client={{
            id: client.id,
            businessName: client.businessName,
            contactName: client.contactName,
            email: client.email,
            phone: client.phone,
            status: client.status,
            notes: client.notes,
          }}
          trigger={<Button variant="outline">Edit client</Button>}
        />
      </PageHeader>

      <Card className="mb-6">
        <CardContent className="grid grid-cols-2 gap-4 p-6 text-sm md:grid-cols-4">
          <Info label="Status">
            <StatusBadge status={client.status} />
          </Info>
          <Info label="Contact">{client.contactName ?? "—"}</Info>
          <Info label="Email">{client.email ?? "—"}</Info>
          <Info label="Phone">{formatPhone(client.phone)}</Info>
          <Info label="Properties held">{props.length}</Info>
          <Info label="Monthly recurring">
            {formatCurrency(monthlyRecurring)}
          </Info>
          {client.notes ? (
            <div className="col-span-2 md:col-span-4">
              <Info label="Notes">{client.notes}</Info>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mb-2 text-sm font-medium text-muted-foreground">
        Lifetime (their assignments + leads stamped to them)
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Lifetime revenue"
          value={formatCurrency(lifetime.lifetimeRevenue)}
          hint={`Flat rent + ${formatCurrency(lifetime.leadRevenue)} per-lead`}
        />
        <StatCard
          label="Lifetime estimated value"
          value={formatCurrency(lifetime.lifetimeEstimatedValue)}
        />
        <StatCard
          label="Lifetime gap"
          value={formatCurrency(lifetime.gap)}
          hint="Estimated value − revenue"
        />
        <StatCard
          label="Months rented"
          value={String(lifetime.monthsRented)}
          hint={`${lifetime.propertiesEverRented} propert${lifetime.propertiesEverRented === 1 ? "y" : "ies"} ever rented`}
        />
      </div>

      <div className="mb-2 text-sm font-medium text-muted-foreground">
        Last 30 days (combined)
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Leads"
          value={formatNumber(metrics.totalLeads)}
          hint={`${formatNumber(metrics.calls)} calls · ${formatNumber(metrics.forms)} forms · ${formatNumber(metrics.billable)} billable`}
        />
        <StatCard
          label="Actual revenue"
          value={formatCurrency(metrics.actualRevenue)}
          hint="Per-lead charges (SUM billed)"
        />
        <StatCard
          label="Estimated value"
          value={formatCurrency(metrics.estimatedValue)}
          hint="Market value of billable leads"
        />
        <StatCard
          label="Gap"
          value={formatCurrency(gap)}
          hint="Estimated value − actual revenue"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
          <CardDescription>
            Properties currently assigned to this client.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Niche</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead className="text-right">Monthly rate</TableHead>
                  <TableHead className="text-right">30d leads</TableHead>
                  <TableHead className="text-right">30d est. value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No properties assigned.
                    </TableCell>
                  </TableRow>
                ) : (
                  props.map((p) => {
                    const c = counts.get(p.id);
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
                        <TableCell className="capitalize text-muted-foreground">
                          {p.niche ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {BILLING_LABEL[p.billingType] ?? titleCase(p.billingType)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(p.monthlyRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(c?.total ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(c?.estimatedValue ?? "0")}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
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
