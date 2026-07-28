"use client";

import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { exportLeadsCsv } from "@/lib/actions/export";
import type { LeadFilters } from "@/lib/queries/leads";

export function ExportCsvButton({
  fixed = {},
}: {
  /** Filters forced on regardless of URL (e.g. propertyId on a detail page). */
  fixed?: Partial<LeadFilters>;
}) {
  const params = useSearchParams();
  const [pending, setPending] = useState(false);

  async function onExport() {
    setPending(true);
    try {
      const filters: LeadFilters = {
        propertyId: params.get("property") ?? undefined,
        clientId: params.get("client") ?? undefined,
        type: params.get("type") ?? undefined,
        source: params.get("source") ?? undefined,
        billableStatus: params.get("billableStatus") ?? undefined,
        deliveryStatus: params.get("deliveryStatus") ?? undefined,
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
        q: params.get("q") ?? undefined,
        // Fixed filters win (e.g. a property detail page scoping export).
        ...fixed,
      };
      const csv = await exportLeadsCsv(filters);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `leads-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" onClick={onExport} disabled={pending}>
      <Download className="mr-2 h-4 w-4" />
      {pending ? "Exporting…" : "Export CSV"}
    </Button>
  );
}
