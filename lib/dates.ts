import { addDays, addMonths, startOfDay, startOfMonth, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { sql, type SQL } from "drizzle-orm";

// ---------------------------------------------------------------------------
// All date bucketing happens in the org timezone. Timestamps are UTC in the DB;
// we convert to the org tz only to decide day/month boundaries, then convert
// those boundaries back to UTC instants for range filtering. DST-safe: we do
// the calendar math on wall-clock fields, then map to UTC.
// ---------------------------------------------------------------------------

export interface DateRange {
  /** inclusive lower bound (UTC instant) */
  start: Date;
  /** exclusive upper bound (UTC instant) */
  end: Date;
}

export interface ComparativeWindow {
  current: DateRange;
  previous: DateRange;
}

/** UTC instant of the start of "today" in the org timezone. */
export function startOfTodayUtc(tz: string, now: Date = new Date()): Date {
  const zonedNow = toZonedTime(now, tz);
  const zonedStart = startOfDay(zonedNow);
  return fromZonedTime(zonedStart, tz);
}

/**
 * A whole-day window ending at end-of-today (org tz) spanning `lengthDays`
 * calendar days, plus the immediately preceding window of equal length.
 * lengthDays = 1 -> today vs yesterday; 7 -> last 7 days vs the 7 before; etc.
 */
export function comparativeDayWindow(
  tz: string,
  lengthDays: number,
  now: Date = new Date(),
): ComparativeWindow {
  const zonedNow = toZonedTime(now, tz);
  const todayStart = startOfDay(zonedNow);
  const tomorrowStart = addDays(todayStart, 1);

  const currentStartZoned = subDays(tomorrowStart, lengthDays);
  const previousStartZoned = subDays(currentStartZoned, lengthDays);

  return {
    current: {
      start: fromZonedTime(currentStartZoned, tz),
      end: fromZonedTime(tomorrowStart, tz),
    },
    previous: {
      start: fromZonedTime(previousStartZoned, tz),
      end: fromZonedTime(currentStartZoned, tz),
    },
  };
}

/** The last `days` calendar days including today (org tz), as a single range. */
export function trailingDayRange(
  tz: string,
  days: number,
  now: Date = new Date(),
): DateRange {
  const zonedNow = toZonedTime(now, tz);
  const todayStart = startOfDay(zonedNow);
  const tomorrowStart = addDays(todayStart, 1);
  const startZoned = subDays(tomorrowStart, days);
  return {
    start: fromZonedTime(startZoned, tz),
    end: fromZonedTime(tomorrowStart, tz),
  };
}

/** UTC range for a given calendar month (1-12) in the org timezone. */
export function monthRangeUtc(
  tz: string,
  year: number,
  month1to12: number,
): DateRange {
  // Build the wall-clock start of the month, then convert to UTC.
  const startZoned = startOfMonth(new Date(year, month1to12 - 1, 1, 0, 0, 0, 0));
  const endZoned = addMonths(startZoned, 1);
  return {
    start: fromZonedTime(startZoned, tz),
    end: fromZonedTime(endZoned, tz),
  };
}

export interface MonthKey {
  year: number;
  /** 1-12 */
  month: number;
  /** e.g. "2026-07" */
  key: string;
  /** e.g. "July 2026" */
  label: string;
  /** e.g. "Jul 2026" */
  shortLabel: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function monthKey(year: number, month1to12: number): MonthKey {
  return {
    year,
    month: month1to12,
    key: `${year}-${String(month1to12).padStart(2, "0")}`,
    label: `${MONTH_NAMES[month1to12 - 1]} ${year}`,
    shortLabel: `${MONTH_SHORT[month1to12 - 1]} ${year}`,
  };
}

/** The current calendar month in the org timezone. */
export function currentMonthKey(tz: string, now: Date = new Date()): MonthKey {
  const zoned = toZonedTime(now, tz);
  return monthKey(zoned.getFullYear(), zoned.getMonth() + 1);
}

/** Integer month index (year*12 + month-1) of a UTC instant, in the org tz. */
export function monthIndexInTz(date: Date, tz: string): number {
  const z = toZonedTime(date, tz);
  return z.getFullYear() * 12 + z.getMonth();
}

/** Integer month index of the current month in the org tz. */
export function currentMonthIndex(tz: string, now: Date = new Date()): number {
  return monthIndexInTz(now, tz);
}

/** Parse "YYYY-MM" into a MonthKey, or return the current month if invalid. */
export function parseMonthKey(
  value: string | undefined,
  tz: string,
  now: Date = new Date(),
): MonthKey {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    if (m >= 1 && m <= 12) return monthKey(y, m);
  }
  return currentMonthKey(tz, now);
}

/** Shift a "YYYY-MM-DD" date by `deltaDays` (may be negative), as "YYYY-MM-DD". */
export function shiftDateStr(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** The org-local calendar date of a UTC instant, as "YYYY-MM-DD". */
export function localDateStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Whole days from date A to date B (both "YYYY-MM-DD"); negative if B < A. */
export function daysBetween(fromDateStr: string, toDateStr: string): number {
  const [ay, am, ad] = fromDateStr.split("-").map(Number);
  const [by, bm, bd] = toDateStr.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86400000);
}

/** The calendar day before a "YYYY-MM-DD" date, as "YYYY-MM-DD". */
export function previousDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** "YYYY-MM-DD" for the current date in the org timezone. */
export function todayDateStr(tz: string, now: Date = new Date()): string {
  const z = toZonedTime(now, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`;
}

/** "YYYY-MM-DDTHH:mm" for the current time in the org tz (datetime-local value). */
export function nowLocalInputValue(tz: string, now: Date = new Date()): string {
  const z = toZonedTime(now, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}T${pad(
    z.getHours(),
  )}:${pad(z.getMinutes())}`;
}

export interface LocalDay {
  /** YYYY-MM-DD in org tz */
  key: string;
  /** e.g. "Jul 3" */
  label: string;
}

/** The last `n` org-local calendar days including today, oldest first. */
export function lastNLocalDays(
  tz: string,
  n: number,
  now: Date = new Date(),
): LocalDay[] {
  const zonedNow = toZonedTime(now, tz);
  const todayStart = startOfDay(zonedNow);
  const out: LocalDay[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = subDays(todayStart, i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push({
      key: `${y}-${m}-${day}`,
      label: `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`,
    });
  }
  return out;
}

/** The current month plus the previous N months (most recent first). */
export function recentMonths(
  tz: string,
  count: number,
  now: Date = new Date(),
): MonthKey[] {
  const zoned = toZonedTime(now, tz);
  const base = startOfMonth(zoned);
  const out: MonthKey[] = [];
  for (let i = 0; i < count; i++) {
    const d = addMonths(base, -i);
    out.push(monthKey(d.getFullYear(), d.getMonth() + 1));
  }
  return out;
}

/**
 * Convert org-local "YYYY-MM-DD" from/to strings into a UTC range.
 * `from` is inclusive start-of-day; `to` is inclusive, so end is exclusive
 * start of the day after `to`. Either bound may be omitted.
 */
export function dayRangeUtc(
  tz: string,
  from?: string,
  to?: string,
): { start?: Date; end?: Date } {
  const out: { start?: Date; end?: Date } = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const [y, m, d] = from.split("-").map(Number);
    out.start = fromZonedTime(new Date(y, m - 1, d, 0, 0, 0, 0), tz);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const [y, m, d] = to.split("-").map(Number);
    const nextDay = addDays(new Date(y, m - 1, d, 0, 0, 0, 0), 1);
    out.end = fromZonedTime(nextDay, tz);
  }
  return out;
}

// ---------------------------------------------------------------------------
// SQL helpers for grouping by org-local calendar day / month.
//
// The timezone MUST be inlined as a literal, never a bind parameter. If it is
// bound, each occurrence of the date expression (SELECT vs GROUP BY vs ORDER
// BY) gets a distinct placeholder ($1, $2, …), and Postgres then treats them
// as different expressions — so the bucketed occurred_at is no longer "covered"
// by GROUP BY and it raises: column "leads.occurred_at" must appear in the
// GROUP BY clause. Inlining makes every occurrence render identically.
// ---------------------------------------------------------------------------

/**
 * Render a validated IANA timezone as a single-quoted SQL literal. IANA names
 * are restricted to [A-Za-z0-9_+-/]; anything else is rejected outright so we
 * never interpolate untrusted text.
 */
function tzLiteral(tz: string): SQL {
  if (!/^[A-Za-z0-9_+/-]+$/.test(tz)) {
    throw new Error(`Unsafe timezone value: ${JSON.stringify(tz)}`);
  }
  return sql.raw(`'${tz}'`);
}

/** SQL expression: the org-local calendar date of a timestamptz column. */
export function localDateExpr(tz: string, column: SQL | unknown): SQL {
  return sql`(${column} AT TIME ZONE ${tzLiteral(tz)})::date`;
}

/** SQL expression: the org-local first-of-month date of a timestamptz column. */
export function localMonthExpr(tz: string, column: SQL | unknown): SQL {
  return sql`date_trunc('month', ${column} AT TIME ZONE ${tzLiteral(tz)})::date`;
}

// ---------------------------------------------------------------------------
// Presentation-layer formatting (always in the org timezone).
// ---------------------------------------------------------------------------

export function formatInTz(
  date: Date | null | undefined,
  tz: string,
  opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(date);
}

export function formatDateInTz(date: Date | null | undefined, tz: string): string {
  return formatInTz(date, tz, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
