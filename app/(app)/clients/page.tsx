import Link from "next/link";
import { Plus } from "lucide-react";
import { asc, eq, isNull, sql } from "drizzle-orm";

import { ClientDialog } from "@/components/clients/client-dialog";
import { ClientRowActions } from "@/components/clients/client-row-actions";
import { PageHeader } from "@/components/page-header";
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
import { formatNumber } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { getClientRangeCounts } from "@/lib/queries/metrics";
import { getAppSettings } from "@/lib/settings";

export const metadata = { title: "Clients — LeadGen" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { orgTimezone: tz } = await getAppSettings();

  const [rows, propCountRows, leadCounts] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.businessName)),
    db
      .select({
        clientId: properties.clientId,
        count: sql<number>`count(*)::int`,
      })
      .from(properties)
      .where(isNull(properties.deletedAt))
      .groupBy(properties.clientId),
    getClientRangeCounts(trailingDayRange(tz, 30)),
  ]);

  const propCount = new Map<string, number>();
  for (const r of propCountRows) {
    if (r.clientId) propCount.set(r.clientId, r.count);
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Business owners renting leads."
      >
        <ClientDialog
          mode="create"
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add client
            </Button>
          }
        />
      </PageHeader>

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Properties</TableHead>
                <TableHead className="text-right">30d leads</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No clients yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/clients/${c.id}`}
                        className="hover:underline"
                      >
                        {c.businessName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.contactName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatPhone(c.phone)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(propCount.get(c.id) ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(leadCounts.get(c.id) ?? 0)}
                    </TableCell>
                    <TableCell>
                      <ClientRowActions
                        client={{
                          id: c.id,
                          businessName: c.businessName,
                          contactName: c.contactName,
                          email: c.email,
                          phone: c.phone,
                          status: c.status,
                          notes: c.notes,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
