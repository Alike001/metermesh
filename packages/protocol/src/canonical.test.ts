import { describe, expect, it } from "vitest";

import { canonicalize, hashCanonical } from "./canonical.js";

describe("canonical JSON", () => {
  it("sorts object keys recursively while preserving array order", () => {
    const left = { z: [3, { b: true, a: null }], a: "value" };
    const right = { a: "value", z: [3, { a: null, b: true }] };

    expect(canonicalize(left)).toBe('{"a":"value","z":[3,{"a":null,"b":true}]}');
    expect(hashCanonical(left)).toBe(hashCanonical(right));
  });

  it("distinguishes array order", () => {
    expect(hashCanonical(["first", "second"])).not.toBe(hashCanonical(["second", "first"]));
  });

  it.each([
    ["floating point", 1.5],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
    ["undefined", undefined],
    ["bigint", 1n],
    ["date object", new Date("2026-08-19T00:00:00.000Z")],
  ])("rejects %s values instead of serializing them ambiguously", (_label, value) => {
    expect(() => canonicalize(value as never)).toThrow(TypeError);
  });
});
