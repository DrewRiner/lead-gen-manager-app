import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { and, asc, isNotNull, isNull, sql } from "drizzle-orm";

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

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const sp = await searchParams;
  const showDeleted = sp.deleted === "1";
  const { orgTimezone: tz } = await getAppSettings();

  const [rows, pairedRows, leadCounts, deletedCountRow] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(showDeleted ? isNotNull(clients.deletedAt) : isNull(clients.deletedAt))
      .orderBy(asc(clients.businessName)),
    // Every property currently paired to a client (client_id → clients.id). One
    // query, grouped in memory below — not per-row. Display only; client_id is
    // never written here.
    db
      .select({
        id: properties.id,
        clientId: properties.clientId,
        name: properties.name,
        displayName: properties.displayName,
      })
      .from(properties)
      .where(and(isNull(properties.deletedAt), isNotNull(properties.clientId)))
      .orderBy(asc(properties.name)),
    getClientRangeCounts(trailingDayRange(tz, 30)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(isNotNull(clients.deletedAt)),
  ]);
  const deletedCount = deletedCountRow[0]?.count ?? 0;

  // clientId → its paired properties (id + shown name). Handles 0/1/many.
  const propsByClient = new Map<string, { id: string; name: string }[]>();
  for (const r of pairedRows) {
    if (!r.clientId) continue;
    const list = propsByClient.get(r.clientId) ?? [];
    list.push({ id: r.id, name: r.displayName ?? r.name });
    propsByClient.set(r.clientId, list);
  }

  return (
    <div>
      <PageHeader
        title={showDeleted ? "Deleted clients" : "Clients"}
        description={
          showDeleted
            ? "Soft-deleted clients. Restore to return them to lists and pickers."
            : "Business owners renting leads."
        }
      >
        {showDeleted ? (
          <Button asChild variant="outline">
            <Link href="/clients">Back to active</Link>
          </Button>
        ) : (
          <>
            <ClientDialog
              mode="create"
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Add client
                </Button>
              }
            />
            {deletedCount > 0 ? (
              <Button asChild variant="outline">
                <Link href="/clients?deleted=1">
                  <Trash2 className="mr-2 h-4 w-4" /> Deleted ({deletedCount})
                </Link>
              </Button>
            ) : null}
          </>
        )}
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
                <TableHead>Properties</TableHead>
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
                    {showDeleted ? "No deleted clients." : "No clients yet."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <Link
                          href={`/clients/${c.id}`}
                          className="hover:underline"
                        >
                          {c.businessName}
                        </Link>
                        {c.deletedAt ? (
                          <span className="rounded-full border border-dashed px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Deleted
                          </span>
                        ) : null}
                      </span>
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
                    <TableCell className="max-w-xs text-sm">
                      <PairedProperties items={propsByClient.get(c.id) ?? []} />
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
                        deleted={showDeleted}
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

// Properties paired to a client. Zero → a deliberate muted "Not paired"; up to
// two shown inline (linked to detail), the rest collapsed into "+N more".
function PairedProperties({ items }: { items: { id: string; name: string }[] }) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">Not paired</span>;
  }
  const shown = items.slice(0, 2);
  const extra = items.length - shown.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      {shown.map((p, i) => (
        <span key={p.id} className="whitespace-nowrap">
          <Link href={`/properties/${p.id}`} className="hover:underline">
            {p.name}
          </Link>
          {i < shown.length - 1 ? (
            <span className="text-muted-foreground">,</span>
          ) : null}
        </span>
      ))}
      {extra > 0 ? (
        <span className="whitespace-nowrap text-muted-foreground">
          +{extra} more
        </span>
      ) : null}
    </span>
  );
}
