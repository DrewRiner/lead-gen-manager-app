import { describe, expect, it } from "vitest";

import {
  isDummyPhone,
  isFakeName,
  hasNonLatinScript,
  hasUrl,
  scoreFormLead,
  SPAM_CONFIG,
  type SpamDeps,
  type SpamScoreInput,
} from "./score-form-lead";

// Injected deps: MX + rate lookups are mocked so scoring is pure and offline.
function deps(over: Partial<SpamDeps> = {}): SpamDeps {
  return {
    lookupMx: async () => true, // domain has mail by default
    rateCounts: async () => ({ sameContactCount: 0, distinctProperties: 0 }),
    threshold: SPAM_CONFIG.defaultThreshold,
    ...over,
  };
}

function input(over: Partial<SpamScoreInput> = {}): SpamScoreInput {
  return {
    email: "jane@example.com",
    phone: "+14045551212",
    name: "Jane Smith",
    message: "I need a quote for a new roof on my house, please call me.",
    ip: "203.0.113.5",
    rawFields: {},
    ...over,
  };
}

describe("scoreFormLead — headline behaviors", () => {
  it("honeypot alone is spam (definitive)", async () => {
    const r = await scoreFormLead(
      input({ rawFields: { website: "http://spam.ru" } }),
      deps(),
    );
    expect(r.score).toBeGreaterThanOrEqual(SPAM_CONFIG.defaultThreshold);
    expect(r.isSpam).toBe(true);
    expect(r.signals).toContain("honeypot field filled");
  });

  it("honeypot key is case-insensitive (Website / WEBSITE)", async () => {
    for (const key of ["website", "Website", "WEBSITE"]) {
      const r = await scoreFormLead(input({ rawFields: { [key]: "x" } }), deps());
      expect(r.isSpam).toBe(true);
    }
  });

  it("empty honeypot means human — not spam", async () => {
    const r = await scoreFormLead(input({ rawFields: { website: "" } }), deps());
    expect(r.isSpam).toBe(false);
    expect(r.score).toBe(0);
  });

  it("a real lead with one soft signal is NOT spam (conservative)", async () => {
    // Valid MX, real phone, normal message — plus a single soft signal (a repeat
    // submission). +30 alone is far below 70.
    const r = await scoreFormLead(
      input(),
      deps({ rateCounts: async () => ({ sameContactCount: 5, distinctProperties: 0 }) }),
    );
    expect(r.score).toBe(SPAM_CONFIG.weights.repeatContact);
    expect(r.isSpam).toBe(false);
  });

  it("disposable email + dummy phone is spam", async () => {
    const r = await scoreFormLead(
      input({ email: "bob@mailinator.com", phone: "5555555555" }),
      deps({ lookupMx: async () => true }),
    );
    // disposable (40) + dummy phone (30) = 70 >= threshold.
    expect(r.score).toBe(
      SPAM_CONFIG.weights.disposable + SPAM_CONFIG.weights.dummyPhone,
    );
    expect(r.isSpam).toBe(true);
    expect(r.signals).toEqual(
      expect.arrayContaining(["disposable email", "dummy phone number"]),
    );
  });

  it("a legit lead with a sparse message is NOT spam", async () => {
    const r = await scoreFormLead(
      input({ message: "roof leak" }),
      deps(),
    );
    expect(r.isSpam).toBe(false);
  });

  it("no MX record is a strong (but not alone sufficient) signal", async () => {
    const r = await scoreFormLead(input(), deps({ lookupMx: async () => false }));
    expect(r.score).toBe(SPAM_CONFIG.weights.noMx); // 50 < 70
    expect(r.isSpam).toBe(false);
    expect(r.signals).toContain("no MX record");
  });
});

describe("scoreFormLead — threshold boundary", () => {
  it("scores exactly at the threshold count as spam (>=)", async () => {
    // Force a total of exactly 70 via no-MX (50) + a medium URL signal (30) = 80;
    // instead use disposable (40) + dummy phone (30) = 70 to hit the boundary.
    const r = await scoreFormLead(
      input({ email: "x@mailinator.com", phone: "1111111111" }),
      deps({ threshold: 70 }),
    );
    expect(r.score).toBe(70);
    expect(r.isSpam).toBe(true);
  });

  it("one point under the threshold is NOT spam", async () => {
    const r = await scoreFormLead(input(), deps({ threshold: 51, lookupMx: async () => false }));
    expect(r.score).toBe(50);
    expect(r.isSpam).toBe(false);
  });
});

describe("scoreFormLead — keyword capping and combinations", () => {
  it("caps keyword points regardless of hit count", async () => {
    const r = await scoreFormLead(
      input({
        message: "cheap SEO backlinks to rank your site, make money with crypto",
      }),
      deps(),
    );
    // Many hits, but capped at keywordCap (40). No URL here.
    const kwSignal = r.signals.find((s) => s.startsWith("spam keywords"));
    expect(kwSignal).toBeDefined();
    expect(r.score).toBe(SPAM_CONFIG.weights.keywordCap);
  });

  it("URL in message + non-Latin script stack", async () => {
    const r = await scoreFormLead(
      input({ message: "Загрузите на http://x.ru прямо сейчас" }),
      deps(),
    );
    expect(r.signals).toEqual(
      expect.arrayContaining(["link in message", "non-Latin script in message"]),
    );
    expect(r.score).toBe(
      SPAM_CONFIG.weights.messageUrl + SPAM_CONFIG.weights.nonLatin,
    );
  });
});

describe("pure signal detectors", () => {
  it("isDummyPhone: repeated, sequential, known dummies", () => {
    expect(isDummyPhone("5555555555")).toBe(true);
    expect(isDummyPhone("0000000000")).toBe(true);
    expect(isDummyPhone("1234567890")).toBe(true);
    expect(isDummyPhone("+1 234 567 8901")).toBe(false); // real-ish
    expect(isDummyPhone("+14045551212")).toBe(false);
  });

  it("isFakeName: asdf, test test, single/all-one-char", () => {
    expect(isFakeName("asdf")).toBe(true);
    expect(isFakeName("test test")).toBe(true);
    expect(isFakeName("a")).toBe(true);
    expect(isFakeName("aaaa")).toBe(true);
    expect(isFakeName("Jane Smith")).toBe(false);
  });

  it("hasUrl / hasNonLatinScript", () => {
    expect(hasUrl("visit http://x.com")).toBe(true);
    expect(hasUrl("visit www.x.com")).toBe(true);
    expect(hasUrl("no links here")).toBe(false);
    expect(hasNonLatinScript("привет")).toBe(true); // Cyrillic
    expect(hasNonLatinScript("你好")).toBe(true); // CJK
    expect(hasNonLatinScript("hello there")).toBe(false);
  });
});

describe("scoreFormLead — resembles the real Brunswick Roofing lead", () => {
  it("is NOT spam (valid MX mocked)", async () => {
    // Mirrors the captured GHL payload already in the system.
    const r = await scoreFormLead(
      {
        email: "jane@example.com",
        phone: "+16785555555",
        name: "Jane Doe",
        message:
          "Property Type: Residential / Service Type: Roof Replacement / Tell us anything we should know: need a re roof",
        ip: "1.2.3.4",
        rawFields: {
          contact_source: "Brunswick Roofing Company",
          "Property Type": "Residential",
          "Service Type": "Roof Replacement",
        },
      },
      deps(),
    );
    expect(r.isSpam).toBe(false);
    expect(r.score).toBe(0);
  });
});
