import {
  and,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { dayRangeUtc, trailingDayRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { clients, leads, properties } from "@/lib/db/schema";
import { toMoneyString } from "@/lib/money";

export interface LeadFilters {
  propertyId?: string;
  clientId?: string;
  type?: string;
  source?: string;
  billableStatus?: string;
  deliveryStatus?: string;
  from?: string; // YYYY-MM-DD (org tz)
  to?: string; // YYYY-MM-DD (org tz)
  q?: string;
}

export interface LeadListRow {
  id: string;
  propertyId: string | null;
  propertyName: string | null;
  niche: string | null;
  clientId: string | null;
  clientName: string | null;
  type: string;
  source: string;
  callerName: string | null;
  callerPhone: string | null;
  callerEmail: string | null;
  message: string | null;
  callDurationSeconds: number | null;
  recordingUrl: string | null;
  callAnswered: boolean | null;
  isRepeatCaller: boolean | null;
  transcript: string | null;
  billableStatus: string;
  billableReason: string | null;
  qualifiedBy: string | null;
  billedAmount: string;
  estimatedValue: string;
  deliveryStatus: string;
  sourceSystem: string;
  externalId: string | null;
  // GoHighLevel ingestion context (null for manual leads).
  ghlLeadSourceRaw: string | null;
  pageUrl: string | null;
  formName: string | null;
  /** Swept custom form fields (label -> value); null for calls/manual leads. */
  formAnswers: Record<string, string> | null;
  occurredAt: Date;
  createdAt: Date;
}

function buildConditions(tz: string, filters: LeadFilters): SQL {
  const conds: SQL[] = [isNull(leads.deletedAt)];
  if (filters.propertyId) conds.push(eq(leads.propertyId, filters.propertyId));
  if (filters.clientId) conds.push(eq(leads.clientId, filters.clientId));
  if (filters.type) conds.push(eq(leads.type, filters.type as never));
  if (filters.source) conds.push(eq(leads.source, filters.source as never));
  if (filters.billableStatus)
    conds.push(eq(leads.billableStatus, filters.billableStatus as never));
  if (filters.deliveryStatus)
    conds.push(eq(leads.deliveryStatus, filters.deliveryStatus as never));

  const { start, end } = dayRangeUtc(tz, filters.from, filters.to);
  if (start) conds.push(gte(leads.occurredAt, start));
  if (end) conds.push(lt(leads.occurredAt, end));

  if (filters.q) {
    const like = `%${filters.q}%`;
    conds.push(
      or(
        ilike(leads.callerName, like),
        ilike(leads.callerPhone, like),
        ilike(leads.callerEmail, like),
        ilike(leads.message, like),
      )!,
    );
  }
  return and(...conds)!;
}

export interface LeadPage {
  rows: LeadListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function getLeads(
  tz: string,
  filters: LeadFilters,
  page = 1,
  pageSize = 25,
): Promise<LeadPage> {
  const where = buildConditions(tz, filters);
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * pageSize;

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: leads.id,
        propertyId: leads.propertyId,
        propertyName: properties.name,
        niche: properties.niche,
        clientId: leads.clientId,
        clientName: clients.businessName,
        type: leads.type,
        source: leads.source,
        callerName: leads.callerName,
        callerPhone: leads.callerPhone,
        callerEmail: leads.callerEmail,
        message: leads.message,
        callDurationSeconds: leads.callDurationSeconds,
        recordingUrl: leads.recordingUrl,
        callAnswered: leads.callAnswered,
        isRepeatCaller: leads.isRepeatCaller,
        transcript: leads.transcript,
        billableStatus: leads.billableStatus,
        billableReason: leads.billableReason,
        qualifiedBy: leads.qualifiedBy,
        billedAmount: leads.billedAmount,
        estimatedValue: leads.estimatedValue,
        deliveryStatus: leads.deliveryStatus,
        sourceSystem: leads.sourceSystem,
        externalId: leads.externalId,
        ghlLeadSourceRaw: leads.ghlLeadSourceRaw,
        pageUrl: leads.pageUrl,
        formName: leads.formName,
        formAnswers: leads.formAnswers,
        occurredAt: leads.occurredAt,
        createdAt: leads.createdAt,
      })
      .from(leads)
      // Left join: unmatched leads have a null property and must still show.
      .leftJoin(properties, eq(properties.id, leads.propertyId))
      .leftJoin(clients, eq(clients.id, leads.clientId))
      .where(where)
      .orderBy(desc(leads.occurredAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(where),
  ]);

  const total = countRow?.count ?? 0;
  return {
    rows: rows.map((r) => ({
      ...r,
      billedAmount: toMoneyString(r.billedAmount),
      estimatedValue: toMoneyString(r.estimatedValue),
    })),
    total,
    page: safePage,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface LeadTypeCounts {
  total: number;
  calls: number;
  forms: number;
}

/**
 * Total / calls / forms split for the given filter scope. The `type` filter is
 * intentionally ignored so the split is always visible even while the list is
 * toggled to a single type.
 */
export async function getLeadTypeCounts(
  tz: string,
  filters: LeadFilters,
): Promise<LeadTypeCounts> {
  const where = buildConditions(tz, { ...filters, type: undefined });
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      calls: sql<number>`(count(*) filter (where ${leads.type} = 'call'))::int`,
      forms: sql<number>`(count(*) filter (where ${leads.type} = 'form'))::int`,
    })
    .from(leads)
    .where(where);
  return {
    total: row?.total ?? 0,
    calls: row?.calls ?? 0,
    forms: row?.forms ?? 0,
  };
}

/** All rows matching filters (no pagination) — used for CSV export. */
export async function getAllLeadsForExport(
  tz: string,
  filters: LeadFilters,
): Promise<LeadListRow[]> {
  const { rows } = await getLeads(tz, filters, 1, 100000);
  return rows;
}

/** Count of ingested leads awaiting property assignment. */
export async function getUnmatchedLeadCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(isNull(leads.deletedAt), eq(leads.billableStatus, "unmatched")));
  return row?.count ?? 0;
}

/**
 * Form leads flagged spam in the trailing `days` (by occurred_at, org tz). A
 * gut-check that the spam filter isn't too aggressive or too loose.
 */
export async function getSpamLeadCount(
  tz: string,
  days = 30,
): Promise<number> {
  const { start, end } = trailingDayRange(tz, days);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        isNull(leads.deletedAt),
        eq(leads.billableStatus, "spam"),
        gte(leads.occurredAt, start),
        lt(leads.occurredAt, end),
      ),
    );
  return row?.count ?? 0;
}
