import type { TransactionExplanation } from "@metermesh/ai";
import {
  hashCanonical,
  signEnvelope,
  type CanonicalValue,
  type Envelope,
} from "@metermesh/protocol";
import { describe, expect, it, vi } from "vitest";

import {
  MAX_METER_MESH_CONTENT_BYTES,
  METER_MESH_CONTENT_PREFIX,
  decodeCarrierMessage,
  encodeCarrierEnvelope,
  inspectCarrierTextMessages,
} from "./codec.js";
import { createMeterMeshIdentity } from "./signer.js";

const buyerKey = `0x${"11".repeat(32)}` as const;
const sellerKey = `0x${"22".repeat(32)}` as const;
const buyerInboxId = "buyer-xmtp-inbox-001";
const sellerInboxId = "seller-xmtp-inbox-001";
const transactionHash = `0x${"33".repeat(32)}` as const;

const explanation: TransactionExplanation = {
  call: {
    createdContract: null,
    from: `0x${"11".repeat(20)}`,
    inputByteLength: 68,
    inputSelector: "0xa9059cbb",
    to: `0x${"22".repeat(20)}`,
  },
  chainId: 1952,
  chainName: "X Layer Testnet",
  emittedLogs: [],
  failureReason: null,
  financials: {
    executionFeeOkb: "0.000042",
    executionFeeWei: "42000000000000",
    valueOkb: "0",
    valueWei: "0",
  },
  generation: {
    aiAuthoredFields: ["summary", "outcome", "limitations"],
    model: "openai/gpt-oss-20b",
    provider: "groq",
    responseId: "codec-fixture",
  },
  limitations: ["The user intent is not present in the chain facts."],
  outcome: "The called address executed without an EVM-level revert.",
  provenance: {
    blockHash: `0x${"44".repeat(32)}`,
    blockNumber: "100",
    confirmations: "3",
    factsFetchedAt: "2026-08-20T10:00:00.000Z",
    source: "x-layer-rpc",
  },
  schemaVersion: "1",
  status: "success",
  summary: "The transaction completed successfully on X Layer Testnet.",
  transactionHash,
};

function asCanonical(value: unknown): CanonicalValue {
  return value as CanonicalValue;
}

async function requestEnvelope(): Promise<Envelope> {
  return signEnvelope(
    {
      createdAt: "2026-08-20T10:00:00.000Z",
      messageId: "request-001",
      payload: { transactionHash, workUnitId: "work-001" },
      protocol: "metermesh",
      senderInboxId: buyerInboxId,
      sequence: 1,
      sessionId: "session-001",
      type: "work.request",
      version: 1,
    },
    createMeterMeshIdentity(buyerKey).envelopeSigner,
  );
}

async function deliveryEnvelope(): Promise<Envelope> {
  return signEnvelope(
    {
      createdAt: "2026-08-20T10:00:05.000Z",
      messageId: "delivery-001",
      payload: {
        deliverySchema: "metermesh.transaction-explanation.v1",
        requestMessageId: "request-001",
        resultHash: hashCanonical(asCanonical(explanation)),
        transactionHash,
        workUnitId: "work-001",
      },
      protocol: "metermesh",
      senderInboxId: sellerInboxId,
      sequence: 1,
      sessionId: "session-001",
      type: "work.delivery",
      version: 1,
    },
    createMeterMeshIdentity(sellerKey).envelopeSigner,
  );
}

const authorized = vi.fn(() => Promise.resolve(true));

describe("XMTP MeterMesh envelope codec", () => {
  it("round-trips a signed request and verifies the XMTP identity binding", async () => {
    const envelope = await requestEnvelope();
    const message = {
      content: encodeCarrierEnvelope(envelope),
      id: "carrier-001",
      senderInboxId: buyerInboxId,
    };

    await expect(
      decodeCarrierMessage(message, { isSignerAuthorized: authorized }),
    ).resolves.toEqual({
      envelope,
      ok: true,
      result: null,
    });
    expect(authorized).toHaveBeenCalledWith(buyerInboxId, envelope.signature.signer);
  });

  it("carries a schema-valid explanation whose hash is bound to the delivery", async () => {
    const envelope = await deliveryEnvelope();
    const content = encodeCarrierEnvelope(envelope, explanation);

    await expect(
      decodeCarrierMessage(
        { content, id: "carrier-002", senderInboxId: sellerInboxId },
        { isSignerAuthorized: authorized },
      ),
    ).resolves.toEqual({ envelope, ok: true, result: explanation });
  });

  it("rejects missing, changed, or unrelated delivery results", async () => {
    const envelope = await deliveryEnvelope();
    expect(() => encodeCarrierEnvelope(envelope)).toThrow();
    expect(() =>
      encodeCarrierEnvelope(envelope, { ...explanation, summary: "Changed after signing." }),
    ).toThrow("hash does not match");
    expect(() =>
      encodeCarrierEnvelope(envelope, {
        ...explanation,
        transactionHash: `0x${"55".repeat(32)}`,
      }),
    ).toThrow("transaction hash does not match");
  });

  it.each([
    ["plain text", "invalid_protocol_content"],
    [`${METER_MESH_CONTENT_PREFIX}{`, "invalid_json"],
    [`${METER_MESH_CONTENT_PREFIX}${JSON.stringify({ extra: true })}`, "invalid_protocol_content"],
    [
      `${METER_MESH_CONTENT_PREFIX}${" ".repeat(MAX_METER_MESH_CONTENT_BYTES)}`,
      "content_too_large",
    ],
  ])("rejects malformed carrier content", async (content, expectedCode) => {
    await expect(
      decodeCarrierMessage(
        { content, id: "bad-carrier", senderInboxId: buyerInboxId },
        { isSignerAuthorized: authorized },
      ),
    ).resolves.toMatchObject({ code: expectedCode, ok: false });
  });

  it("rejects sender mismatch and a signer that XMTP does not authorize", async () => {
    const envelope = await requestEnvelope();
    const content = encodeCarrierEnvelope(envelope);

    await expect(
      decodeCarrierMessage(
        { content, id: "carrier-mismatch", senderInboxId: sellerInboxId },
        { isSignerAuthorized: authorized },
      ),
    ).resolves.toMatchObject({ code: "sender_inbox_mismatch", ok: false });
    await expect(
      decodeCarrierMessage(
        { content, id: "carrier-unauthorized", senderInboxId: buyerInboxId },
        { isSignerAuthorized: () => Promise.resolve(false) },
      ),
    ).resolves.toMatchObject({ code: "signer_not_authorized", ok: false });
  });

  it("rejects an invalid sequence before the envelope can reach durable state", async () => {
    const envelope = await requestEnvelope();
    const content = `${METER_MESH_CONTENT_PREFIX}${JSON.stringify({
      envelope: { ...envelope, sequence: 0 },
    })}`;

    await expect(
      decodeCarrierMessage(
        { content, id: "carrier-bad-sequence", senderInboxId: buyerInboxId },
        { isSignerAuthorized: authorized },
      ),
    ).resolves.toMatchObject({ code: "invalid_protocol_envelope", ok: false });
  });

  it("classifies previously persisted carrier IDs as duplicates before reprocessing", async () => {
    const envelope = await requestEnvelope();
    const messages = [
      {
        content: encodeCarrierEnvelope(envelope),
        id: "carrier-seen",
        senderInboxId: buyerInboxId,
      },
    ];

    await expect(
      inspectCarrierTextMessages(messages, {
        isSignerAuthorized: authorized,
        seenCarrierMessageIds: new Set(["carrier-seen"]),
      }),
    ).resolves.toEqual([{ carrierMessageId: "carrier-seen", status: "duplicate" }]);
  });

  it("accepts a repeated carrier ID only once within the same synchronized batch", async () => {
    const envelope = await requestEnvelope();
    const message = {
      content: encodeCarrierEnvelope(envelope),
      id: "carrier-repeated",
      senderInboxId: buyerInboxId,
    };

    await expect(
      inspectCarrierTextMessages([message, message], { isSignerAuthorized: authorized }),
    ).resolves.toEqual([
      { carrierMessageId: message.id, envelope, result: null, status: "accepted" },
      { carrierMessageId: message.id, status: "duplicate" },
    ]);
  });
});
