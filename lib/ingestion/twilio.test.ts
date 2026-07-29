import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { evaluateLead } from "@/lib/billing/evaluate-lead";
import { matchProperty, type PropertyCandidate } from "@/lib/ingestion/match";
import { twilioSignatureValid } from "@/lib/ingestion/webhook-auth";
import { normalizeTwilio, twilioEventType } from "./adapters/twilio";

const NOW = new Date("2026-07-29T14:10:00.000Z");
const CALL_SID = "CA1234567890abcdef1234567890abcdef";

// A realistic Twilio voice status-callback param map (form-decoded).
function completed(over: Record<string, string> = {}): Record<string, string> {
  return {
    CallSid: CALL_SID,
    AccountSid: "AC00000000000000000000000000000000",
    From: "+19125551234", // caller (display only)
    To: "+19045550100", // dialed tracking number (routing key)
    CallStatus: "completed",
    CallDuration: "142",
    Direction: "inbound",
    RecordingUrl: "https://api.twilio.com/2010-04-01/Recordings/RE123",
    Timestamp: "Wed, 29 Jul 2026 14:05:00 +0000",
    ...over,
  };
}

// A property candidate whose tracking number is the dialed To number.
function candidate(over: Partial<PropertyCandidate> = {}): PropertyCandidate {
  return {
    id: "prop-1",
    clientId: "client-1",
    ghlLeadSource: null,
    shortCode: null,
    ghlFormId: null,
    domain: null,
    trackingPhone: "+19045550100",
    billingType: "per_lead",
    perLeadCallRate: "45.00",
    perLeadFormRate: "30.00",
    estimatedCallValue: "90.00",
    estimatedFormValue: "60.00",
    billableThresholdSeconds: 60,
    ...over,
  };
}

describe("normalizeTwilio — field mapping", () => {
  it("maps the confirmed Twilio param names", () => {
    const c = normalizeTwilio(completed(), NOW);
    expect(c.provider).toBe("twilio");
    expect(c.type).toBe("call");
    // De-dupe key + convenience column both come from CallSid.
    expect(c.externalId).toBe(CALL_SID);
    expect(c.twilioCallSid).toBe(CALL_SID);
    expect(c.callrailCallId).toBeNull();
    // Dialed number (To) is the routing key; caller (From) is display-only.
    expect(c.trackingPhone).toBe("+19045550100");
    expect(c.phone).toBe("+19125551234");
    expect(c.callDurationSeconds).toBe(142);
    expect(c.callAnswered).toBe(true);
    expect(c.recordingUrl).toBe("https://api.twilio.com/2010-04-01/Recordings/RE123");
    expect(c.occurredAt.toISOString()).toBe("2026-07-29T14:05:00.000Z");
    expect(c.occurredAtFallback).toBe(false);
    // No transcript / repeat-caller signal from Twilio, no form fields.
    expect(c.transcript).toBeNull();
    expect(c.isRepeatCaller).toBeNull();
    expect(c.email).toBeNull();
    expect(c.leadSourceRaw).toBeNull();
  });

  it("normalizes messy To / From numbers to E.164", () => {
    const c = normalizeTwilio(completed({ To: "(904) 555-0100", From: "912-555-1234" }), NOW);
    expect(c.trackingPhone).toBe("+19045550100");
    expect(c.phone).toBe("+19125551234");
  });

  it("falls back to receipt time when Timestamp is absent", () => {
    const p = completed();
    delete p.Timestamp;
    const c = normalizeTwilio(p, NOW);
    expect(c.occurredAt.toISOString()).toBe(NOW.toISOString());
    expect(c.occurredAtFallback).toBe(true);
  });

  it("synthesizes a deterministic external id when CallSid is missing", () => {
    const p = completed();
    delete p.CallSid;
    const c = normalizeTwilio(p, NOW);
    expect(c.twilioCallSid).toBeNull();
    expect(c.externalId).toBe("twilio_+19045550100_2026-07-29T14:05:00.000Z");
  });

  it("labels the event by CallStatus", () => {
    expect(twilioEventType(completed())).toBe("completed");
    expect(twilioEventType(completed({ CallStatus: "no-answer" }))).toBe("no-answer");
  });
});

describe("normalizeTwilio — answered vs missed (CallStatus)", () => {
  it("treats completed as answered", () => {
    expect(normalizeTwilio(completed({ CallStatus: "completed" }), NOW).callAnswered).toBe(true);
  });

  it.each(["no-answer", "busy", "failed", "canceled"])(
    "treats %s as missed",
    (status) => {
      expect(normalizeTwilio(completed({ CallStatus: status }), NOW).callAnswered).toBe(false);
    },
  );

  it("treats a non-terminal status as unknown (null)", () => {
    expect(normalizeTwilio(completed({ CallStatus: "in-progress" }), NOW).callAnswered).toBeNull();
  });
});

describe("normalizeTwilio — idempotency key", () => {
  it("two deliveries of the same CallSid share an external id (de-dupes to one lead)", () => {
    const first = normalizeTwilio(completed(), NOW);
    // A retry with an added RecordingUrl — same CallSid.
    const retry = normalizeTwilio(
      completed({ RecordingUrl: "https://api.twilio.com/.../RE999" }),
      NOW,
    );
    expect(retry.externalId).toBe(first.externalId);
    expect(retry.externalId).toBe(CALL_SID);
  });
});

describe("Twilio resolution by dialed To number", () => {
  it("matches the property whose tracking_phone equals the dialed number", () => {
    const c = normalizeTwilio(completed(), NOW);
    const match = matchProperty([candidate()], c);
    expect(match?.property.id).toBe("prop-1");
    expect(match?.strategy).toBe("tracking_phone");
  });

  it("matches regardless of E.164 vs formatting differences on either side", () => {
    const c = normalizeTwilio(completed({ To: "1 (904) 555-0100" }), NOW);
    const match = matchProperty([candidate({ trackingPhone: "904-555-0100" })], c);
    expect(match?.property.id).toBe("prop-1");
  });

  it("never routes by the caller (From)", () => {
    const c = normalizeTwilio(completed(), NOW);
    // Candidate's tracking number equals the CALLER's number, not the dialed one.
    const match = matchProperty([candidate({ trackingPhone: "+19125551234" })], c);
    expect(match).toBeNull();
  });

  it("no matching tracking number => unmatched (null)", () => {
    const c = normalizeTwilio(completed({ To: "+15555550000" }), NOW);
    expect(matchProperty([candidate()], c)).toBeNull();
  });
});

describe("Twilio billing via evaluateLead (CALL path, 60s threshold)", () => {
  const property = {
    billingType: "per_lead" as const,
    perLeadCallRate: "45.00",
    perLeadFormRate: "30.00",
    estimatedCallValue: "90.00",
    estimatedFormValue: "60.00",
    billableThresholdSeconds: 60,
  };

  it("a 142s completed call is billable via the duration rule", async () => {
    const c = normalizeTwilio(completed(), NOW);
    const d = await evaluateLead(
      { type: "call", callDurationSeconds: c.callDurationSeconds },
      property,
    );
    expect(d.billableStatus).toBe("billable");
    expect(d.qualifiedBy).toBe("duration_rule");
  });

  it("null CallDuration => pending_review (never form_validation)", async () => {
    const p = completed();
    delete p.CallDuration;
    const c = normalizeTwilio(p, NOW);
    expect(c.callDurationSeconds).toBeNull();
    const d = await evaluateLead(
      { type: "call", callDurationSeconds: c.callDurationSeconds },
      property,
    );
    expect(d.billableStatus).toBe("pending_review");
    expect(d.qualifiedBy).toBe("duration_rule");
  });
});

describe("twilioSignatureValid — X-Twilio-Signature (HMAC-SHA1)", () => {
  const TOKEN = "test_auth_token_abc123";
  const URL = "https://lead-gen-manager-app.vercel.app/api/webhooks/twilio";

  /** Build a valid signature the way Twilio does: url + sorted key+value. */
  function sign(url: string, params: Record<string, string>, token: string): string {
    let data = url;
    for (const k of Object.keys(params).sort()) data += k + params[k];
    return createHmac("sha1", token).update(data, "utf8").digest("base64");
  }

  it("accepts a correctly signed request", () => {
    const params = completed();
    const sig = sign(URL, params, TOKEN);
    expect(twilioSignatureValid(URL, params, sig, TOKEN)).toBe(true);
  });

  it("rejects a tampered param (signature no longer matches)", () => {
    const params = completed();
    const sig = sign(URL, params, TOKEN);
    const tampered = { ...params, CallDuration: "999" };
    expect(twilioSignatureValid(URL, tampered, sig, TOKEN)).toBe(false);
  });

  it("rejects a wrong auth token", () => {
    const params = completed();
    const sig = sign(URL, params, TOKEN);
    expect(twilioSignatureValid(URL, params, sig, "wrong_token")).toBe(false);
  });

  it("rejects a mismatched URL", () => {
    const params = completed();
    const sig = sign(URL, params, TOKEN);
    expect(twilioSignatureValid(URL + "?x=1", params, sig, TOKEN)).toBe(false);
  });

  it("returns false when the signature or token is missing", () => {
    const params = completed();
    expect(twilioSignatureValid(URL, params, null, TOKEN)).toBe(false);
    expect(twilioSignatureValid(URL, params, "abc", null)).toBe(false);
  });
});
