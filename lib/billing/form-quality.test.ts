import { describe, expect, it } from "vitest";

import {
  classifyFormQuality,
  hasValidEmail,
  hasValidPhone,
  isDummyPhone,
  isJunkName,
  isTestEmail,
} from "./form-quality";

describe("form-quality detectors", () => {
  it("hasValidEmail / hasValidPhone", () => {
    expect(hasValidEmail("jane@acme.com")).toBe(true);
    expect(hasValidEmail("garbage")).toBe(false);
    expect(hasValidEmail("")).toBe(false);
    expect(hasValidPhone("+14045551212")).toBe(true);
    expect(hasValidPhone("911")).toBe(false);
    expect(hasValidPhone(null)).toBe(false);
  });

  it("isJunkName", () => {
    expect(isJunkName("test test")).toBe(true);
    expect(isJunkName("test")).toBe(true);
    expect(isJunkName("asdf")).toBe(true);
    expect(isJunkName("a")).toBe(true);
    expect(isJunkName("aaaa")).toBe(true);
    expect(isJunkName("drew riner")).toBe(false);
  });

  it("isTestEmail", () => {
    expect(isTestEmail("test@test.com")).toBe(true);
    expect(isTestEmail("a@a.com")).toBe(true);
    expect(isTestEmail("test123@live.com")).toBe(true); // test* prefix
    expect(isTestEmail("drewriner@hotmail.com")).toBe(false);
    expect(isTestEmail("jane@acme.com")).toBe(false);
  });

  it("isDummyPhone", () => {
    expect(isDummyPhone("5555555555")).toBe(true);
    expect(isDummyPhone("1234567890")).toBe(true);
    expect(isDummyPhone("+19125555555")).toBe(false); // real-ish
    expect(isDummyPhone("+14045551212")).toBe(false);
  });
});

describe("classifyFormQuality", () => {
  it("legit lead: has contact, not low quality", () => {
    const r = classifyFormQuality({
      email: "drewriner@hotmail.com",
      phone: null,
      name: "drew riner",
      message: "roof leak",
      hasFormAnswers: false,
    });
    expect(r.hasContact).toBe(true);
    expect(r.lowQuality).toBe(false);
  });

  it("Sumter junk: junk name + test email = 2 signals => low quality", () => {
    const r = classifyFormQuality({
      email: "test123@live.com",
      phone: "+19125555555",
      name: "test test",
      message: null,
      hasFormAnswers: false,
    });
    expect(r.hasContact).toBe(true); // valid email format
    expect(r.lowQuality).toBe(true);
    expect(r.signals).toContain("junk name");
    expect(r.signals).toContain("test email");
  });

  it("one signal alone does NOT flag low quality (conservative)", () => {
    // Junk name only, but a real email and a message.
    const r = classifyFormQuality({
      email: "jane@acme.com",
      phone: "+14045551212",
      name: "test",
      message: "please call me",
      hasFormAnswers: false,
    });
    expect(r.lowQuality).toBe(false);
  });

  it("no contact info at all", () => {
    const r = classifyFormQuality({
      email: null,
      phone: null,
      name: "Jane",
      message: "hi",
      hasFormAnswers: false,
    });
    expect(r.hasContact).toBe(false);
  });
});
