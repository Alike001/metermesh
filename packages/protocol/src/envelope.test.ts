import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import {
  buildUnsignedEnvelope,
  envelopeSigningDigest,
  signEnvelope,
  validateEnvelope,
} from "./envelope.js";
import { hashCanonical } from "./canonical.js";

const sessionId = "session-001";
const transactionHash = hashCanonical("transaction-001");

function requestDraft() {
  return {
    createdAt: "2026-08-19T12:00:00+01:00",
    messageId: "message-001",
    payload: { transactionHash, workUnitId: "work-001" },
    protocol: "metermesh" as const,
    senderInboxId: "buyer-inbox",
    sequence: 1,
    sessionId,
    type: "work.request" as const,
    version: 1 as const,
  };
}

describe("signed envelopes", () => {
  it("normalizes, hashes, signs, and verifies a valid envelope", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const envelope = await signEnvelope(requestDraft(), account);

    expect(envelope.createdAt).toBe("2026-08-19T11:00:00.000Z");
    expect(envelope.payloadHash).toBe(hashCanonical(envelope.payload));
    await expect(validateEnvelope(envelope)).resolves.toEqual({ envelope, ok: true });
  });

  it("produces the same signing digest for equivalent normalized input", () => {
    const first = buildUnsignedEnvelope(requestDraft());
    const second = buildUnsignedEnvelope({
      ...requestDraft(),
      createdAt: "2026-08-19T11:00:00.000Z",
      payload: { workUnitId: "work-001", transactionHash },
    });

    expect(envelopeSigningDigest(first)).toBe(envelopeSigningDigest(second));
  });

  it("detects payload tampering before signature verification", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const envelope = await signEnvelope(requestDraft(), account);
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, workUnitId: "work-002" },
    };

    const result = await validateEnvelope(tampered);
    expect(result).toMatchObject({
      error: { code: "payload_hash_mismatch" },
      ok: false,
    });
  });

  it("rejects a signature attributed to a different signer", async () => {
    const signer = privateKeyToAccount(generatePrivateKey());
    const impostor = privateKeyToAccount(generatePrivateKey());
    const envelope = await signEnvelope(requestDraft(), signer);

    const result = await validateEnvelope({
      ...envelope,
      signature: { ...envelope.signature, signer: impostor.address },
    });
    expect(result).toEqual({ error: { code: "invalid_signature" }, ok: false });
  });

  it("turns malformed cryptographic signature values into a validation result", async () => {
    const signer = privateKeyToAccount(generatePrivateKey());
    const envelope = await signEnvelope(requestDraft(), signer);
    const result = await validateEnvelope({
      ...envelope,
      signature: { ...envelope.signature, value: `0x${"00".repeat(65)}` },
    });

    expect(result).toEqual({ error: { code: "invalid_signature" }, ok: false });
  });

  it("rejects unknown fields and malformed hashes", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const envelope = await signEnvelope(requestDraft(), account);

    const result = await validateEnvelope({
      ...envelope,
      unexpected: "field",
    });
    expect(result).toMatchObject({ error: { code: "invalid_schema" }, ok: false });
  });
});
