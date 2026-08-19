import { keccak256, toHex, type Hex } from "viem";

type JsonPrimitive = boolean | null | number | string;
export type CanonicalValue = JsonPrimitive | CanonicalValue[] | { [key: string]: CanonicalValue };

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function serialize(value: unknown, path: string): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`Canonical JSON requires a safe integer at ${path}.`);
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item, index) => serialize(item, `${path}[${String(index)}]`)).join(",")}]`;
  }

  if (typeof value === "object" && isPlainObject(value)) {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${serialize(item, `${path}.${key}`)}`)
      .join(",")}}`;
  }

  throw new TypeError(`Canonical JSON cannot encode ${typeof value} at ${path}.`);
}

export function canonicalize(value: CanonicalValue): string {
  return serialize(value, "$");
}

export function hashCanonical(value: CanonicalValue): Hex {
  return keccak256(toHex(canonicalize(value)));
}
