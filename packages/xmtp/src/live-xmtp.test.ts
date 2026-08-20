import { randomBytes } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { TransactionExplanation } from "@metermesh/ai";
import { hashCanonical, signEnvelope, type CanonicalValue } from "@metermesh/protocol";
import { toHex } from "viem";
import { generatePrivateKey } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { NodeXmtpCarrier, type AcceptedCarrierEnvelope } from "./carrier.js";
import type { MeterMeshXmtpConfig } from "./config.js";
import { createMeterMeshIdentity } from "./signer.js";

const liveTest = process.env.METERMESH_LIVE_XMTP === "1" ? it : it.skip;
const transactionHash = "0xafe21e8d40d641bec6bba559ed40a2289689cab89d306f67c99e0ee38873973f";

const explanation: TransactionExplanation = {
  call: {
    createdContract: null,
    from: `0x${"11".repeat(20)}`,
    inputByteLength: 0,
    inputSelector: null,
    to: `0x${"22".repeat(20)}`,
  },
  chainId: 1952,
  chainName: "X Layer Testnet",
  emittedLogs: [],
  failureReason: null,
  financials: {
    executionFeeOkb: "0",
    executionFeeWei: "0",
    valueOkb: "0",
    valueWei: "0",
  },
  generation: {
    aiAuthoredFields: ["summary", "outcome", "limitations"],
    model: "openai/gpt-oss-20b",
    provider: "groq",
    responseId: "xmtp-live-carrier-fixture",
  },
  limitations: ["This carrier test validates delivery transport, not a new AI generation."],
  outcome: "The delivery remains bound to its public X Layer transaction reference.",
  provenance: {
    blockHash: `0x${"44".repeat(32)}`,
    blockNumber: "0",
    confirmations: "1",
    factsFetchedAt: "2026-08-20T10:00:00.000Z",
    source: "x-layer-rpc",
  },
  schemaVersion: "1",
  status: "success",
  summary: "MeterMesh transported this schema-valid explanation through XMTP dev.",
  transactionHash,
};

function asCanonical(value: unknown): CanonicalValue {
  return value as CanonicalValue;
}

function createConfig(dbPath: string): MeterMeshXmtpConfig {
  return {
    appVersion: "metermesh-carrier-test/0.1.0",
    dbEncryptionKey: toHex(randomBytes(32)),
    dbPath,
    env: "dev",
    walletKey: generatePrivateKey(),
  };
}

async function waitForEnvelope(
  carrier: NodeXmtpCarrier,
  messageId: string,
  timeoutMs = 45_000,
): Promise<AcceptedCarrierEnvelope> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const inspected = await carrier.inspectMessages(await carrier.syncMessages());
    const match = inspected.find(
      (item): item is AcceptedCarrierEnvelope =>
        item.status === "accepted" && item.envelope.messageId === messageId,
    );
    if (match !== undefined) return match;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`XMTP message ${messageId} did not arrive before the timeout.`);
}

describe("live XMTP dev carrier", () => {
  liveTest(
    "sends, receives, deduplicates, and recovers a request and delivery",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "metermesh-xmtp-"));
      const buyerConfig = createConfig(join(directory, "buyer.db3"));
      const sellerConfig = createConfig(join(directory, "seller.db3"));
      const [buyer, seller] = await Promise.all([
        NodeXmtpCarrier.connect(buyerConfig),
        NodeXmtpCarrier.connect(sellerConfig),
      ]);

      let restartedSeller: NodeXmtpCarrier | null = null;
      try {
        const request = await signEnvelope(
          {
            createdAt: new Date().toISOString(),
            messageId: `request-${Date.now().toString()}`,
            payload: { transactionHash, workUnitId: "live-work-001" },
            protocol: "metermesh",
            senderInboxId: buyer.inboxId,
            sequence: 1,
            sessionId: `live-session-${Date.now().toString()}`,
            type: "work.request",
            version: 1,
          },
          createMeterMeshIdentity(buyerConfig.walletKey).envelopeSigner,
        );

        const firstCarrierId = await buyer.sendEnvelope(seller.inboxId, request);
        const duplicateCarrierId = await buyer.sendEnvelope(seller.inboxId, request);
        expect(duplicateCarrierId).toBe(firstCarrierId);

        const receivedRequest = await waitForEnvelope(seller, request.messageId);
        expect(receivedRequest.envelope).toEqual(request);
        expect(receivedRequest.result).toBeNull();

        const delivery = await signEnvelope(
          {
            createdAt: new Date().toISOString(),
            messageId: `delivery-${Date.now().toString()}`,
            payload: {
              deliverySchema: "metermesh.transaction-explanation.v1",
              requestMessageId: request.messageId,
              resultHash: hashCanonical(asCanonical(explanation)),
              transactionHash,
              workUnitId: "live-work-001",
            },
            protocol: "metermesh",
            senderInboxId: seller.inboxId,
            sequence: 1,
            sessionId: request.sessionId,
            type: "work.delivery",
            version: 1,
          },
          createMeterMeshIdentity(sellerConfig.walletKey).envelopeSigner,
        );

        await seller.sendEnvelope(buyer.inboxId, delivery, explanation);
        const receivedDelivery = await waitForEnvelope(buyer, delivery.messageId);
        expect(receivedDelivery.envelope).toEqual(delivery);
        expect(receivedDelivery.result).toEqual(explanation);

        await seller.close();
        restartedSeller = await NodeXmtpCarrier.connect(sellerConfig);
        const recovered = await waitForEnvelope(restartedSeller, request.messageId);
        expect(recovered.carrierMessageId).toBe(firstCarrierId);

        await restartedSeller.close();
        restartedSeller = null;
        await expect(
          NodeXmtpCarrier.connect({
            ...sellerConfig,
            dbEncryptionKey: toHex(randomBytes(32)),
          }),
        ).rejects.toThrow();
      } finally {
        await Promise.allSettled([buyer.close(), seller.close(), restartedSeller?.close()]);
      }
    },
    150_000,
  );
});
