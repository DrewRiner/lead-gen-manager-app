import { Plus } from "lucide-react";
import { asc, isNull } from "drizzle-orm";

import { AddLeadDialog } from "@/components/leads/add-lead-dialog";
import { ExportCsvButton } from "@/components/leads/export-csv-button";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { LeadsTable } from "@/components/leads/leads-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import { nowLocalInputValue } from "@/lib/dates";
import { db } from "@/lib/db";
import { clients, properties } from "@/lib/db/schema";
import { getLeads, getUnmatchedLeadCount } from "@/lib/queries/leads";
import { getAppSettings } from "@/lib/settings";

export const metadata = { title: "Leads — LeadGen" };
export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { orgTimezone: tz } = await getAppSettings();
  const page = Math.max(1, Number(sp.page) || 1);

  const [leadsPage, propertyList, clientList, unmatchedCount] =
    await Promise.all([
      getLeads(
        tz,
        {
          propertyId: sp.property,
          clientId: sp.client,
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
        .select({ id: properties.id, name: properties.name })
        .from(properties)
        .where(isNull(properties.deletedAt))
        .orderBy(asc(properties.name)),
      db
        .select({ id: clients.id, businessName: clients.businessName })
        .from(clients)
        .where(isNull(clients.deletedAt))
        .orderBy(asc(clients.businessName)),
      getUnmatchedLeadCount(),
    ]);

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Every call and form lead across all properties."
      >
        <ExportCsvButton />
        <AddLeadDialog
          properties={propertyList}
          defaultOccurredAt={nowLocalInputValue(tz)}
          tzLabel={tz}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add lead manually
            </Button>
          }
        />
      </PageHeader>

      {unmatchedCount > 0 && sp.billableStatus !== "unmatched" ? (
        <Link
          href="/leads?billableStatus=unmatched"
          className="mb-4 flex items-center justify-between rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/40 dark:hover:bg-orange-950/60"
        >
          <span className="font-medium text-orange-800 dark:text-orange-300">
            {unmatchedCount} unmatched lead{unmatchedCount === 1 ? "" : "s"}{" "}
            need a property.
          </span>
          <span className="text-orange-700 underline underline-offset-2 dark:text-orange-400">
            Review →
          </span>
        </Link>
      ) : null}

      <div className="mb-4">
        <LeadsFilters properties={propertyList} clients={clientList} />
      </div>

      <div className="rounded-lg border">
        <LeadsTable rows={leadsPage.rows} tz={tz} properties={propertyList} />
        <div className="border-t px-4">
          <Pagination
            page={leadsPage.page}
            pageCount={leadsPage.pageCount}
            total={leadsPage.total}
            pageSize={leadsPage.pageSize}
          />
        </div>
      </div>
    </div>
  );
}
