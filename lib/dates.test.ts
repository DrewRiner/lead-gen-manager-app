import { toZonedTime } from "date-fns-tz";
import { describe, expect, it } from "vitest";

import { comparativeCalendarWindow } from "./dates";

const TZ = "America/New_York";

function local(d: Date) {
  const z = toZonedTime(d, TZ);
  return {
    mo: z.getMonth() + 1,
    day: z.getDate(),
    h: z.getHours(),
    mi: z.getMinutes(),
    dow: z.getDay(), // 0 Sun .. 1 Mon
  };
}
const durationMs = (w: { start: Date; end: Date }) =>
  w.end.getTime() - w.start.getTime();

describe("comparativeCalendarWindow — month", () => {
  it("month-to-date mid-month compares against the same days of last month", () => {
    // Mar 15 2026, 12:00 ET (16:00 UTC).
    const now = new Date("2026-03-15T16:00:00Z");
    const w = comparativeCalendarWindow("month", TZ, now);

    const cs = local(w.current.start);
    expect([cs.mo, cs.day, cs.h, cs.mi]).toEqual([3, 1, 0, 0]); // Mar 1 00:00
    expect(w.current.end).toEqual(now);

    const ps = local(w.previous.start);
    expect([ps.mo, ps.day, ps.h, ps.mi]).toEqual([2, 1, 0, 0]); // Feb 1 00:00

    // Same elapsed portion.
    expect(durationMs(w.previous)).toBe(durationMs(w.current));
  });

  it("first day of the month: prior window is a single partial day", () => {
    // Apr 1 2026, 06:00 ET (10:00 UTC).
    const now = new Date("2026-04-01T10:00:00Z");
    const w = comparativeCalendarWindow("month", TZ, now);

    // Current window is just the 6 hours of today so far.
    expect(durationMs(w.current)).toBe(6 * 3600_000);
    expect(local(w.current.start).day).toBe(1);

    // Previous window: Mar 1 00:00 → Mar 1 06:00, a single day, equal duration.
    const ps = local(w.previous.start);
    const pe = local(w.previous.end);
    expect([ps.mo, ps.day, ps.h]).toEqual([3, 1, 0]);
    expect([pe.mo, pe.day]).toEqual([3, 1]); // same calendar day
    expect(durationMs(w.previous)).toBe(6 * 3600_000);
  });
});

describe("comparativeCalendarWindow — week (Monday start)", () => {
  it("week-to-date compares against the same days of the previous week", () => {
    // Wed Mar 18 2026, 10:00 ET (14:00 UTC).
    const now = new Date("2026-03-18T14:00:00Z");
    const w = comparativeCalendarWindow("week", TZ, now);

    const cs = local(w.current.start);
    expect(cs.dow).toBe(1); // Monday
    expect([cs.h, cs.mi]).toEqual([0, 0]);

    const ps = local(w.previous.start);
    expect(ps.dow).toBe(1); // previous Monday
    // Exactly one week earlier (no DST between Mar 9 and Mar 16, 2026).
    expect(w.current.start.getTime() - w.previous.start.getTime()).toBe(
      7 * 86400_000,
    );
    expect(durationMs(w.previous)).toBe(durationMs(w.current));
  });
});

describe("comparativeCalendarWindow — day", () => {
  it("today compares against the same weekday last week", () => {
    // Wed Mar 18 2026, 09:00 ET (13:00 UTC).
    const now = new Date("2026-03-18T13:00:00Z");
    const w = comparativeCalendarWindow("day", TZ, now);

    const cs = local(w.current.start);
    expect([cs.day, cs.h]).toEqual([18, 0]);

    const ps = local(w.previous.start);
    // Same weekday, one week earlier.
    expect(ps.dow).toBe(cs.dow);
    expect(ps.day).toBe(11);
    expect(durationMs(w.previous)).toBe(durationMs(w.current));
  });
});
