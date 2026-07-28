import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  lifetimeFlatRevenue,
  monthIndexFromDate,
  revenuePerMonthRented,
  summarizeLifetime,
  tenureMonthsByClient,
  type AssignmentLite,
  type LifetimeSummary,
} from "@/lib/assignments";
import { currentMonthIndex, monthIndexInTz } from "@/lib/dates";
import { db } from "@/lib/db";
import { clients, leads, properties, propertyAssignments } from "@/lib/db/schema";
import { sumMoney, toMoneyNumber, toMoneyString } from "@/lib/money";

export interface AssignmentRow extends AssignmentLite {
  id: string;
  propertyId: string;
}

/** Assignments (with client name) grouped by property, oldest first. */
export async function getAssignmentsMap(
  propertyIds?: string[],
): Promise<Map<string, AssignmentRow[]>> {
  const where =
    propertyIds && propertyIds.length > 0
      ? inArray(propertyAssignments.propertyId, propertyIds)
      : undefined;

  const rows = await db
    .select({
      id: propertyAssignments.id,
      propertyId: propertyAssignments.propertyId,
      clientId: propertyAssignments.clientId,
      clientName: clients.businessName,
      startedOn: propertyAssignments.startedOn,
      endedOn: propertyAssignments.endedOn,
      billingType: propertyAssignments.billingType,
      monthlyRate: propertyAssignments.monthlyRate,
    })
    .from(propertyAssignments)
    .leftJoin(clients, eq(clients.id, propertyAssignments.clientId))
    .where(where)
    .orderBy(asc(propertyAssignments.startedOn));

  const map = new Map<string, AssignmentRow[]>();
  for (const r of rows) {
    const list = map.get(r.propertyId) ?? [];
    list.push(r);
    map.set(r.propertyId, list);
  }
  return map;
}

// Per-property lifetime lead aggregates (all-time, non-deleted).
interface LeadLifetimeAgg {
  leadRevenue: string; // SUM(billed_amount)
  estimatedValue: string; // SUM(estimated_value)
  firstOccurredAt: Date | null;
  totalLeads: number;
}

async function getLeadLifetimeByProperty(
  propertyIds?: string[],
): Promise<Map<string, LeadLifetimeAgg>> {
  const conds = [isNull(leads.deletedAt)];
  if (propertyIds && propertyIds.length > 0) {
    conds.push(inArray(leads.propertyId, propertyIds));
  }
  const rows = await db
    .select({
      propertyId: leads.propertyId,
      leadRevenue: sql<string>`coalesce(sum(${leads.billedAmount}), 0)::text`,
      estimatedValue: sql<string>`coalesce(sum(${leads.estimatedValue}), 0)::text`,
      firstOccurredAt: sql<Date | null>`min(${leads.occurredAt})`,
      totalLeads: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(and(...conds))
    .groupBy(leads.propertyId);

  const map = new Map<string, LeadLifetimeAgg>();
  for (const r of rows) {
    map.set(r.propertyId, {
      leadRevenue: toMoneyString(r.leadRevenue),
      estimatedValue: toMoneyString(r.estimatedValue),
      firstOccurredAt: r.firstOccurredAt ? new Date(r.firstOccurredAt) : null,
      totalLeads: r.totalLeads,
    });
  }
  return map;
}

export interface PropertyLifetime {
  summary: LifetimeSummary;
  lifetimeRevenue: string;
  lifetimeEstimatedValue: string;
  leadRevenue: string;
  totalLeads: number;
  revenuePerMonthRented: number;
}

/** Lifetime rollup for every property (used to rank the list). */
export async function getPropertyLifetimeMap(
  tz: string,
): Promise<Map<string, PropertyLifetime>> {
  const nowIndex = currentMonthIndex(tz);
  const [assignmentsMap, leadAgg] = await Promise.all([
    getAssignmentsMap(),
    getLeadLifetimeByProperty(),
  ]);

  const propertyIds = new Set<string>([
    ...assignmentsMap.keys(),
    ...leadAgg.keys(),
  ]);

  const out = new Map<string, PropertyLifetime>();
  for (const pid of propertyIds) {
    const assignments = assignmentsMap.get(pid) ?? [];
    const agg = leadAgg.get(pid);
    const firstLeadIdx = agg?.firstOccurredAt
      ? monthIndexInTz(agg.firstOccurredAt, tz)
      : null;
    const summary = summarizeLifetime(assignments, nowIndex, firstLeadIdx);
    const leadRevenue = agg?.leadRevenue ?? "0.00";
    const lifetimeRevenue = sumMoney([summary.lifetimeFlatRevenue, leadRevenue]);
    out.set(pid, {
      summary,
      lifetimeRevenue,
      lifetimeEstimatedValue: agg?.estimatedValue ?? "0.00",
      leadRevenue,
      totalLeads: agg?.totalLeads ?? 0,
      revenuePerMonthRented: revenuePerMonthRented(
        lifetimeRevenue,
        summary.monthsRented,
      ),
    });
  }
  return out;
}

export interface ClientHistoryRow {
  clientId: string;
  clientName: string | null;
  tenureMonths: number;
  firstStarted: string;
  lastEnded: string | null;
  isActive: boolean;
  attributedRevenue: string;
  pctOfLifetimeRevenue: number;
}

export interface PropertyLifetimeDetail extends PropertyLifetime {
  clientHistory: ClientHistoryRow[];
  /** Earliest lead occurred_at (UTC), or null. */
  firstLeadAt: Date | null;
  /** Earliest assignment started_on ("YYYY-MM-DD"), or null. */
  firstAssignmentStartedOn: string | null;
}

/** Full lifetime detail for one property, including per-client history. */
export async function getPropertyLifetime(
  tz: string,
  propertyId: string,
): Promise<PropertyLifetimeDetail> {
  const nowIndex = currentMonthIndex(tz);
  const [assignmentsMap, leadAgg, perClientLeadRows] = await Promise.all([
    getAssignmentsMap([propertyId]),
    getLeadLifetimeByProperty([propertyId]),
    db
      .select({
        clientId: leads.clientId,
        leadRevenue: sql<string>`coalesce(sum(${leads.billedAmount}), 0)::text`,
      })
      .from(leads)
      .where(and(eq(leads.propertyId, propertyId), isNull(leads.deletedAt)))
      .groupBy(leads.clientId),
  ]);

  const assignments = assignmentsMap.get(propertyId) ?? [];
  const agg = leadAgg.get(propertyId);
  const firstLeadIdx = agg?.firstOccurredAt
    ? monthIndexInTz(agg.firstOccurredAt, tz)
    : null;
  const summary = summarizeLifetime(assignments, nowIndex, firstLeadIdx);
  const leadRevenue = agg?.leadRevenue ?? "0.00";
  const lifetimeRevenue = sumMoney([summary.lifetimeFlatRevenue, leadRevenue]);
  const lifetimeNum = toMoneyNumber(lifetimeRevenue);

  const perClientLead = new Map<string, string>();
  for (const r of perClientLeadRows) {
    if (r.clientId) perClientLead.set(r.clientId, toMoneyString(r.leadRevenue));
  }

  // Group assignments by client to build history rows.
  const tenures = tenureMonthsByClient(assignments, nowIndex);
  const byClient = new Map<string, AssignmentLite[]>();
  for (const a of assignments) {
    const list = byClient.get(a.clientId) ?? [];
    list.push(a);
    byClient.set(a.clientId, list);
  }

  const clientHistory: ClientHistoryRow[] = [];
  for (const [clientId, list] of byClient) {
    const flat = lifetimeFlatRevenue(list, nowIndex);
    const leadRev = perClientLead.get(clientId) ?? "0.00";
    const attributed = sumMoney([flat, leadRev]);
    const starts = list.map((a) => a.startedOn).sort();
    const anyActive = list.some((a) => a.endedOn === null);
    const lastEnded = anyActive
      ? null
      : list
          .map((a) => a.endedOn as string)
          .sort()
          .at(-1) ?? null;
    clientHistory.push({
      clientId,
      clientName: list[0]?.clientName ?? tenures.get(clientId)?.clientName ?? null,
      tenureMonths: tenures.get(clientId)?.months ?? 0,
      firstStarted: starts[0],
      lastEnded,
      isActive: anyActive,
      attributedRevenue: attributed,
      pctOfLifetimeRevenue:
        lifetimeNum > 0 ? (toMoneyNumber(attributed) / lifetimeNum) * 100 : 0,
    });
  }
  // Anchor clients first.
  clientHistory.sort(
    (a, b) => toMoneyNumber(b.attributedRevenue) - toMoneyNumber(a.attributedRevenue),
  );

  return {
    summary,
    lifetimeRevenue,
    lifetimeEstimatedValue: agg?.estimatedValue ?? "0.00",
    leadRevenue,
    totalLeads: agg?.totalLeads ?? 0,
    revenuePerMonthRented: revenuePerMonthRented(
      lifetimeRevenue,
      summary.monthsRented,
    ),
    clientHistory,
    firstLeadAt: agg?.firstOccurredAt ?? null,
    firstAssignmentStartedOn: assignments[0]?.startedOn ?? null,
  };
}

export interface ClientLifetime {
  flatRevenue: string;
  leadRevenue: string;
  lifetimeRevenue: string;
  lifetimeEstimatedValue: string;
  gap: string;
  monthsRented: number;
  propertiesEverRented: number;
}

/** Lifetime rollup for a client: their assignments + leads stamped to them. */
export async function getClientLifetime(
  tz: string,
  clientId: string,
): Promise<ClientLifetime> {
  const nowIndex = currentMonthIndex(tz);

  const [assignmentRows, [leadRow]] = await Promise.all([
    db
      .select({
        clientId: propertyAssignments.clientId,
        clientName: clients.businessName,
        startedOn: propertyAssignments.startedOn,
        endedOn: propertyAssignments.endedOn,
        billingType: propertyAssignments.billingType,
        monthlyRate: propertyAssignments.monthlyRate,
        propertyId: propertyAssignments.propertyId,
      })
      .from(propertyAssignments)
      .leftJoin(clients, eq(clients.id, propertyAssignments.clientId))
      .where(eq(propertyAssignments.clientId, clientId)),
    db
      .select({
        leadRevenue: sql<string>`coalesce(sum(${leads.billedAmount}), 0)::text`,
        estimatedValue: sql<string>`coalesce(sum(${leads.estimatedValue}), 0)::text`,
      })
      .from(leads)
      .where(and(eq(leads.clientId, clientId), isNull(leads.deletedAt))),
  ]);

  const assignments: AssignmentLite[] = assignmentRows.map((a) => ({
    clientId: a.clientId,
    clientName: a.clientName,
    startedOn: a.startedOn,
    endedOn: a.endedOn,
    billingType: a.billingType,
    monthlyRate: a.monthlyRate,
  }));

  const flat = lifetimeFlatRevenue(assignments, nowIndex);
  const leadRevenue = toMoneyString(leadRow?.leadRevenue ?? "0");
  const lifetimeRevenue = sumMoney([flat, leadRevenue]);
  const lifetimeEstimatedValue = toMoneyString(leadRow?.estimatedValue ?? "0");
  const gap = sumMoney([
    lifetimeEstimatedValue,
    -toMoneyNumber(lifetimeRevenue),
  ]);

  // Distinct months rented across all their assignments (union of month spans).
  const monthSet = new Set<number>();
  for (const a of assignments) {
    const start = monthIndexFromDate(a.startedOn);
    const end = a.endedOn ? monthIndexFromDate(a.endedOn) : nowIndex;
    for (let i = start; i <= end; i++) monthSet.add(i);
  }
  const propertiesEverRented = new Set(assignmentRows.map((a) => a.propertyId))
    .size;

  return {
    flatRevenue: flat,
    leadRevenue,
    lifetimeRevenue,
    lifetimeEstimatedValue,
    gap,
    monthsRented: monthSet.size,
    propertiesEverRented,
  };
}
