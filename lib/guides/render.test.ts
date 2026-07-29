import { describe, expect, it } from "vitest";

import { embedSrc } from "./render";

describe("embedSrc", () => {
  it("converts YouTube watch URLs", () => {
    expect(embedSrc("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://www.youtube.com/embed/abc123",
    );
    expect(embedSrc("https://youtube.com/watch?v=xyz&t=10s")).toBe(
      "https://www.youtube.com/embed/xyz",
    );
  });

  it("converts youtu.be short URLs", () => {
    expect(embedSrc("https://youtu.be/abc123")).toBe(
      "https://www.youtube.com/embed/abc123",
    );
  });

  it("converts Loom share and embed URLs", () => {
    expect(embedSrc("https://www.loom.com/share/deadbeef1234")).toBe(
      "https://www.loom.com/embed/deadbeef1234",
    );
    expect(embedSrc("https://loom.com/embed/deadbeef1234")).toBe(
      "https://www.loom.com/embed/deadbeef1234",
    );
  });

  it("returns null for unrecognized or invalid URLs", () => {
    expect(embedSrc("https://example.com/video")).toBeNull();
    expect(embedSrc("not a url")).toBeNull();
    expect(embedSrc("https://www.youtube.com/")).toBeNull(); // no video id
  });
});
