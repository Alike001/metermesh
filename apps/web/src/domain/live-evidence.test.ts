import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { transactionExplanationSchema } from "@metermesh/ai";
import { hashCanonical, signEnvelope, type CanonicalValue } from "@metermesh/protocol";

import manifest from "../../public/.well-known/metermesh.json";
import { createLiveEvidenceBundle, verifyLiveEvidenceBundle } from "./live-evidence";

const buyer = privateKeyToAccount(
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);
const seller = privateKeyToAccount(
  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
);

function asCanonical(value: unknown): CanonicalValue {
  return value as CanonicalValue;
}

async function fixtureBundle() {
  const result = transactionExplanationSchema.parse(manifest.examples.explanation);
  const request = await signEnvelope(
    {
      createdAt: "2026-08-21T10:00:00.000Z",
      messageId: "request-live-evidence-001",
      payload: {
        transactionHash: result.transactionHash,
        workUnitId: "work-live-evidence-001",
      },
      protocol: "metermesh",
      senderInboxId: "buyer-live-evidence-inbox",
      sequence: 1,
      sessionId: "session-live-evidence-001",
      type: "work.request",
      version: 1,
    },
    buyer,
  );
  if (request.type !== "work.request") {
    throw new Error("The evidence fixture created an unexpected request type.");
  }
  const delivery = await signEnvelope(
    {
      createdAt: "2026-08-21T10:00:08.000Z",
      messageId: "delivery-live-evidence-001",
      payload: {
        deliverySchema: "metermesh.transaction-explanation.v1",
        requestMessageId: request.messageId,
        resultHash: hashCanonical(asCanonical(result)),
        transactionHash: request.payload.transactionHash,
        workUnitId: request.payload.workUnitId,
      },
      protocol: "metermesh",
      senderInboxId: "seller-live-evidence-inbox",
      sequence: 1,
      sessionId: request.sessionId,
      type: "work.delivery",
      version: 1,
    },
    seller,
  );
  if (delivery.type !== "work.delivery") {
    throw new Error("The evidence fixture created an unexpected delivery type.");
  }
  return createLiveEvidenceBundle(
    { carrierMessageId: "xmtp-request-001", envelope: request },
    { carrierMessageId: "xmtp-delivery-001", envelope: delivery, result },
    new Date("2026-08-21T10:00:10.000Z"),
  );
}

describe("live evidence bundle", () => {
  it("re-runs both signatures and every request-to-result binding", async () => {
    const bundle = await fixtureBundle();
    await expect(verifyLiveEvidenceBundle(bundle)).resolves.toMatchObject({ ok: true });
    expect(bundle.fundsMoved).toBe(false);
    expect(bundle.voucherSigned).toBe(false);
  });

  it("keeps the anchor hash stable when export metadata changes", async () => {
    const bundle = await fixtureBundle();
    const reexported = structuredClone(bundle);
    reexported.exportedAt = "2026-08-22T10:00:10.000Z";

    await expect(verifyLiveEvidenceBundle(reexported)).resolves.toMatchObject({ ok: true });
    expect(reexported.anchorEvidenceHash).toBe(bundle.anchorEvidenceHash);
  });

  it("rejects a proof whose anchor hash was changed", async () => {
    const bundle = await fixtureBundle();
    const modified = structuredClone(bundle);
    modified.anchorEvidenceHash =
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    await expect(verifyLiveEvidenceBundle(modified)).resolves.toEqual({
      detail: "The evidence anchor hash does not match the stable proof contents.",
      ok: false,
    });
  });

  it("detects a modified AI result even when the signed delivery is unchanged", async () => {
    const bundle = await fixtureBundle();
    const modified = structuredClone(bundle);
    modified.result.summary = "Modified after delivery.";

    await expect(verifyLiveEvidenceBundle(modified)).resolves.toEqual({
      detail: "The explanation no longer matches the seller-signed result hash.",
      ok: false,
    });
  });

  it("rejects a modified request envelope and unknown fields", async () => {
    const bundle = await fixtureBundle();
    const modifiedRequest = structuredClone(bundle);
    modifiedRequest.request.envelope.payload.transactionHash =
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    await expect(verifyLiveEvidenceBundle(modifiedRequest)).resolves.toMatchObject({ ok: false });

    await expect(verifyLiveEvidenceBundle({ ...bundle, invented: true })).resolves.toEqual({
      detail: "The live evidence bundle has an invalid shape.",
      ok: false,
    });
  });
});
