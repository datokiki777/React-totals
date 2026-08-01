import { describe, it, expect } from "vitest";
import { hashPin, isValidPinFormat } from "./pin";

describe("hashPin", () => {
  it("produces a 64-char hex SHA-256 digest", async () => {
    const hash = await hashPin("1234");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — the same PIN always hashes the same way", async () => {
    const a = await hashPin("135790");
    const b = await hashPin("135790");
    expect(a).toBe(b);
  });

  it("different PINs hash to different digests", async () => {
    const a = await hashPin("111111");
    const b = await hashPin("111112");
    expect(a).not.toBe(b);
  });

  it("never contains the plaintext PIN as a substring (sanity check)", async () => {
    const hash = await hashPin("246810");
    expect(hash).not.toContain("246810");
  });
});

describe("isValidPinFormat", () => {
  it("accepts 4-8 digit numeric PINs", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("12345678")).toBe(true);
    expect(isValidPinFormat("369700")).toBe(true);
  });

  it("rejects too short, too long, or non-numeric input", () => {
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("123456789")).toBe(false);
    expect(isValidPinFormat("12a4")).toBe(false);
    expect(isValidPinFormat("")).toBe(false);
    expect(isValidPinFormat("  1234")).toBe(false);
  });
});
