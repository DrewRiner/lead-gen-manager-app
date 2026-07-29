import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { callrailSignatureValid } from "./webhook-auth";

const SECRET = "callrail-test-secret";
const BODY = JSON.stringify({ id: "CAL123", duration: 42 });

function sign(body: string, secret: string, enc: "hex" | "base64") {
  return createHmac("sha256", secret).update(body, "utf8").digest(enc);
}

describe("callrailSignatureValid", () => {
  it("accepts a correct hex HMAC-SHA256 signature", () => {
    expect(callrailSignatureValid(BODY, sign(BODY, SECRET, "hex"), SECRET)).toBe(true);
  });

  it("accepts a correct base64 signature (encoding not pinned by CallRail)", () => {
    expect(callrailSignatureValid(BODY, sign(BODY, SECRET, "base64"), SECRET)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    expect(callrailSignatureValid(BODY, sign(BODY, "wrong-secret", "hex"), SECRET)).toBe(false);
  });

  it("rejects when the body was tampered with", () => {
    const sig = sign(BODY, SECRET, "hex");
    expect(callrailSignatureValid(BODY + " ", sig, SECRET)).toBe(false);
  });

  it("rejects missing signature or secret", () => {
    expect(callrailSignatureValid(BODY, null, SECRET)).toBe(false);
    expect(callrailSignatureValid(BODY, sign(BODY, SECRET, "hex"), null)).toBe(false);
  });
});
