"use server";

import { toCsv } from "@/lib/csv";
import { formatInTz } from "@/lib/dates";
import { formatDuration } from "@/lib/format";
import { billableReasonLabel } from "@/lib/leads/labels";
import { getAllLeadsForExport, type LeadFilters } from "@/lib/queries/leads";
import { getOrgTimezone } from "@/lib/settings";

const HEADERS = [
  { key: "occurredAt", label: "Occurred At" },
  { key: "property", label: "Property" },
  { key: "niche", label: "Niche" },
  { key: "client", label: "Client" },
  { key: "type", label: "Type" },
  { key: "source", label: "Source" },
  { key: "callerName", label: "Caller Name" },
  { key: "callerPhone", label: "Caller Phone" },
  { key: "callerEmail", label: "Caller Email" },
  { key: "message", label: "Message" },
  { key: "duration", label: "Duration" },
  { key: "billableStatus", label: "Billable Status" },
  { key: "billableReason", label: "Billable Reason" },
  { key: "qualifiedBy", label: "Qualified By" },
  { key: "billedAmount", label: "Billed Amount" },
  { key: "estimatedValue", label: "Estimated Value" },
  { key: "deliveryStatus", label: "Delivery Status" },
  { key: "sourceSystem", label: "Source System" },
];

/**
 * Build CSV text for all leads matching the given filters (a read, not a
 * mutation — returned to the client which triggers the download).
 */
export async function exportLeadsCsv(filters: LeadFilters): Promise<string> {
  const tz = await getOrgTimezone();
  const rows = await getAllLeadsForExport(tz, filters);

  const records = rows.map((r) => ({
    occurredAt: formatInTz(r.occurredAt, tz, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    property: r.propertyName ?? "(unmatched)",
    niche: r.niche ?? "",
    client: r.clientName ?? "",
    type: r.type,
    source: r.source,
    callerName: r.callerName ?? "",
    callerPhone: r.callerPhone ?? "",
    callerEmail: r.callerEmail ?? "",
    message: r.message ?? "",
    duration: r.type === "call" ? formatDuration(r.callDurationSeconds) : "",
    billableStatus: r.billableStatus,
    // Reworded to state the rule (matches the UI); billed amount stays raw numeric.
    billableReason:
      r.billableReason || r.qualifiedBy === "manual"
        ? billableReasonLabel(r.billableReason, {
            qualifiedBy: r.qualifiedBy,
            thresholdSeconds: r.propertyBillableThresholdSeconds,
          })
        : "",
    qualifiedBy: r.qualifiedBy ?? "",
    billedAmount: r.billedAmount,
    estimatedValue: r.estimatedValue,
    deliveryStatus: r.deliveryStatus,
    sourceSystem: r.sourceSystem,
  }));

  return toCsv(HEADERS, records);
}
