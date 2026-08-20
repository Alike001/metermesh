import { describe, expect, it } from "vitest";

import capturedSession from "../../public/evidence/captured-session.json";
import { formatAtomicAmount, parseCapturedSession, shortHash } from "./session";

describe("captured session evidence", () => {
  it("accepts the checked-in offline evidence record", () => {
    const parsed = parseCapturedSession(capturedSession);

    expect(parsed.capture.fundsMoved).toBe(false);
    expect(parsed.session.chainId).toBe(1952);
    expect(parsed.evidence).toHaveLength(2);
  });

  it("rejects evidence that claims funds moved", () => {
    const invalid = {
      ...capturedSession,
      capture: { ...capturedSession.capture, fundsMoved: true },
    };

    expect(() => parseCapturedSession(invalid)).toThrow("invalid provenance");
  });

  it("formats six-decimal atomic amounts without invented precision", () => {
    expect(formatAtomicAmount("1000")).toBe("0.001");
    expect(formatAtomicAmount("1000000")).toBe("1");
    expect(formatAtomicAmount("1200500")).toBe("1.2005");
  });

  it("shortens fixture hashes while keeping both ends visible", () => {
    expect(shortHash(capturedSession.result.fixtureTransactionHash)).toBe("0x11111111…11111111");
  });
});
