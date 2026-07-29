import { describe, expect, it } from "vitest";

import { evaluateLead } from "@/lib/billing/evaluate-lead";
import {
  callRailEventType,
  normalizeCallRail,
} from "./adapters/callrail";

const NOW = new Date("2026-07-29T14:10:00.000Z");
const CALL_ID = "CAL8154748ae6cd49e5a2b2b5b6c8f1f9a1";

// A realistic CallRail post_call payload.
function postCall(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CALL_ID,
    answered: true,
    business_phone_number: "+19045551000",
    customer_name: "Jane Caller",
    customer_phone_number: "+19125551234",
    duration: 142,
    first_call: true,
    recording: "https://app.callrail.com/calls/123/recording/abc",
    tracking_phone_number: "+19045550100",
    start_time: "2026-07-29T14:05:00.000Z",
    source: "Google Organic",
    ...over,
  };
}

// The later call_modified delivery: same id, enrichment fields appended.
function callModified(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CALL_ID,
    answered: true,
    duration: 142,
    tracking_phone_number: "+19045550100",
    customer_phone_number: "+19125551234",
    recording: "https://app.callrail.com/calls/123/recording/abc",
    recording_duration: 138,
    transcription_text: "Hi, I'd like a quote for a new roof.",
    tags: ["Qualified", "Roofing"],
    first_call: false,
    ...over,
  };
}

describe("normalizeCallRail — post_call", () => {
  it("maps the confirmed CallRail field names", () => {
    const c = normalizeCallRail(postCall(), NOW);
    expect(c.provider).toBe("callrail");
    expect(c.type).toBe("call");
    // De-dupe key + convenience column both come from the CallRail id.
    expect(c.externalId).toBe(CALL_ID);
    expect(c.callrailCallId).toBe(CALL_ID);
    // Dialed tracking number is the routing key; caller is display-only.
    expect(c.trackingPhone).toBe("+19045550100");
    expect(c.phone).toBe("+19125551234");
    expect(c.callDurationSeconds).toBe(142);
    expect(c.callAnswered).toBe(true);
    expect(c.recordingUrl).toBe("https://app.callrail.com/calls/123/recording/abc");
    expect(c.fullName).toBe("Jane Caller");
    expect(c.occurredAt.toISOString()).toBe("2026-07-29T14:05:00.000Z");
    expect(c.occurredAtFallback).toBe(false);
    // first_call true => NOT a repeat caller.
    expect(c.isRepeatCaller).toBe(false);
    // No form fields on a call.
    expect(c.email).toBeNull();
    expect(c.message).toBeNull();
    expect(c.leadSourceRaw).toBeNull();
  });

  it("maps a Google Organic source to 'organic'", () => {
    expect(normalizeCallRail(postCall(), NOW).source).toBe("organic");
  });

  it("normalizes messy tracking + caller numbers to E.164", () => {
    const c = normalizeCallRail(
      postCall({ tracking_phone_number: "(904) 555-0100", customer_phone_number: "912-555-1234" }),
      NOW,
    );
    expect(c.trackingPhone).toBe("+19045550100");
    expect(c.phone).toBe("+19125551234");
  });

  it("marks a missed call (answered=false)", () => {
    expect(normalizeCallRail(postCall({ answered: false }), NOW).callAnswered).toBe(false);
  });

  it("marks a repeat caller (first_call=false)", () => {
    expect(normalizeCallRail(postCall({ first_call: false }), NOW).isRepeatCaller).toBe(true);
  });

  it("null/absent duration -> callDurationSeconds null (then pending_review)", async () => {
    const c = normalizeCallRail(postCall({ duration: undefined }), NOW);
    expect(c.callDurationSeconds).toBeNull();
    const decision = await evaluateLead(
      { type: "call", callDurationSeconds: c.callDurationSeconds },
      {
        billingType: "per_lead",
        perLeadCallRate: "45.00",
        perLeadFormRate: "30.00",
        estimatedCallValue: "90.00",
        estimatedFormValue: "60.00",
        billableThresholdSeconds: 60,
      },
    );
    expect(decision.billableStatus).toBe("pending_review");
    expect(decision.qualifiedBy).toBe("duration_rule");
  });

  it("falls back to receipt time when start_time is absent", () => {
    const c = normalizeCallRail(postCall({ start_time: undefined, created_at: undefined }), NOW);
    expect(c.occurredAt.toISOString()).toBe(NOW.toISOString());
    expect(c.occurredAtFallback).toBe(true);
  });
});

describe("normalizeCallRail — call_modified", () => {
  it("carries the same external id and the later enrichment fields", () => {
    const c = normalizeCallRail(callModified(), NOW);
    // SAME id as post_call => merges into the same lead, not a duplicate.
    expect(c.externalId).toBe(CALL_ID);
    expect(c.transcript).toBe("Hi, I'd like a quote for a new roof.");
    expect(c.recordingUrl).toBe("https://app.callrail.com/calls/123/recording/abc");
    expect(c.callAnswered).toBe(true);
    expect(c.type).toBe("call");
  });
});

describe("callRailEventType", () => {
  it("labels post_call vs call_modified", () => {
    expect(callRailEventType(postCall())).toBe("post_call");
    expect(callRailEventType(callModified())).toBe("call_modified");
  });
});
