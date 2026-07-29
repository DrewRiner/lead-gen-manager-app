import { describe, expect, it } from "vitest";

import { computeRoutingStatuses } from "./routing-status";

function row(id: string, ghlLeadSource: string | null) {
  return { id, ghlLeadSource };
}

describe("computeRoutingStatuses", () => {
  it("marks a set, unique value as mapped", () => {
    const m = computeRoutingStatuses([row("a", "Acme Roofing")]);
    expect(m.get("a")).toBe("mapped");
  });

  it("marks null / empty / whitespace as missing", () => {
    const m = computeRoutingStatuses([
      row("a", null),
      row("b", ""),
      row("c", "   "),
    ]);
    expect(m.get("a")).toBe("missing");
    expect(m.get("b")).toBe("missing");
    expect(m.get("c")).toBe("missing");
  });

  it("flags case-insensitive / trimmed collisions as duplicate on BOTH rows", () => {
    const m = computeRoutingStatuses([
      row("a", "Acme Roofing"),
      row("b", "  acme roofing "),
      row("c", "Unique One"),
    ]);
    expect(m.get("a")).toBe("duplicate");
    expect(m.get("b")).toBe("duplicate");
    expect(m.get("c")).toBe("mapped");
  });

  it("missing values do not count as duplicates of each other", () => {
    const m = computeRoutingStatuses([row("a", null), row("b", "")]);
    expect(m.get("a")).toBe("missing");
    expect(m.get("b")).toBe("missing");
  });
});
