import { transactionExplanationSchema, type TransactionExplanation } from "@metermesh/ai";
import {
  envelopeSchema,
  hashCanonical,
  hashSchema,
  validateEnvelope,
  type CanonicalValue,
  type Envelope,
} from "@metermesh/protocol";

import type { ReceivedBrowserDelivery, SentBrowserRequest } from "../services/browser-xmtp";

type WorkRequestEnvelope = Extract<Envelope, { type: "work.request" }>;
type WorkDeliveryEnvelope = Extract<Envelope, { type: "work.delivery" }>;

export interface LiveEvidenceBundle {
  chainId: 1952;
  anchorEvidenceHash: `0x${string}`;
  delivery: {
    carrierMessageId: string;
    envelope: WorkDeliveryEnvelope;
  };
  exportedAt: string;
  fundsMoved: false;
  kind: "live-nonbillable-verification";
  request: {
    carrierMessageId: string;
    envelope: WorkRequestEnvelope;
  };
  result: TransactionExplanation;
  schemaVersion: "1.0";
  transport: "xmtp-dev";
  verification: {
    buyerEnvelope: "verified";
    resultBinding: "verified";
    sellerEnvelope: "verified";
    sellerInboxAuthorization: "observed-online-at-receipt";
  };
  voucherSigned: false;
}

export type LiveEvidenceVerification =
  { bundle: LiveEvidenceBundle; ok: true } | { detail: string; ok: false };

function asCanonical(value: unknown): CanonicalValue {
  return value as CanonicalValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function parseCarrierRecord(
  value: unknown,
  expectedType: "work.request" | "work.delivery",
): { carrierMessageId: string; envelope: Envelope } | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["carrierMessageId", "envelope"]) ||
    typeof value.carrierMessageId !== "string" ||
    value.carrierMessageId.length === 0
  ) {
    return null;
  }
  const envelope = envelopeSchema.safeParse(value.envelope);
  if (!envelope.success || envelope.data.type !== expectedType) return null;
  return { carrierMessageId: value.carrierMessageId, envelope: envelope.data };
}

function parseBundle(value: unknown): LiveEvidenceBundle | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "chainId",
      "anchorEvidenceHash",
      "delivery",
      "exportedAt",
      "fundsMoved",
      "kind",
      "request",
      "result",
      "schemaVersion",
      "transport",
      "verification",
      "voucherSigned",
    ]) ||
    value.schemaVersion !== "1.0" ||
    value.kind !== "live-nonbillable-verification" ||
    value.chainId !== 1952 ||
    value.transport !== "xmtp-dev" ||
    value.fundsMoved !== false ||
    value.voucherSigned !== false ||
    typeof value.exportedAt !== "string" ||
    Number.isNaN(Date.parse(value.exportedAt))
  ) {
    return null;
  }

  const request = parseCarrierRecord(value.request, "work.request");
  const delivery = parseCarrierRecord(value.delivery, "work.delivery");
  const anchorEvidenceHash = hashSchema.safeParse(value.anchorEvidenceHash);
  const result = transactionExplanationSchema.safeParse(value.result);
  if (request === null || delivery === null || !anchorEvidenceHash.success || !result.success)
    return null;

  if (
    !isRecord(value.verification) ||
    !hasExactKeys(value.verification, [
      "buyerEnvelope",
      "resultBinding",
      "sellerEnvelope",
      "sellerInboxAuthorization",
    ]) ||
    value.verification.buyerEnvelope !== "verified" ||
    value.verification.resultBinding !== "verified" ||
    value.verification.sellerEnvelope !== "verified" ||
    value.verification.sellerInboxAuthorization !== "observed-online-at-receipt"
  ) {
    return null;
  }

  return {
    chainId: 1952,
    anchorEvidenceHash: anchorEvidenceHash.data,
    delivery: {
      carrierMessageId: delivery.carrierMessageId,
      envelope: delivery.envelope as WorkDeliveryEnvelope,
    },
    exportedAt: value.exportedAt,
    fundsMoved: false,
    kind: "live-nonbillable-verification",
    request: {
      carrierMessageId: request.carrierMessageId,
      envelope: request.envelope as WorkRequestEnvelope,
    },
    result: result.data,
    schemaVersion: "1.0",
    transport: "xmtp-dev",
    verification: {
      buyerEnvelope: "verified",
      resultBinding: "verified",
      sellerEnvelope: "verified",
      sellerInboxAuthorization: "observed-online-at-receipt",
    },
    voucherSigned: false,
  };
}

export function createLiveEvidenceBundle(
  request: SentBrowserRequest,
  delivery: ReceivedBrowserDelivery,
  exportedAt = new Date(),
): LiveEvidenceBundle {
  const anchorEvidenceHash = hashLiveEvidenceAnchor(request, delivery);
  return {
    chainId: 1952,
    anchorEvidenceHash,
    delivery: {
      carrierMessageId: delivery.carrierMessageId,
      envelope: delivery.envelope,
    },
    exportedAt: exportedAt.toISOString(),
    fundsMoved: false,
    kind: "live-nonbillable-verification",
    request: {
      carrierMessageId: request.carrierMessageId,
      envelope: request.envelope,
    },
    result: delivery.result,
    schemaVersion: "1.0",
    transport: "xmtp-dev",
    verification: {
      buyerEnvelope: "verified",
      resultBinding: "verified",
      sellerEnvelope: "verified",
      sellerInboxAuthorization: "observed-online-at-receipt",
    },
    voucherSigned: false,
  };
}

export function hashLiveEvidenceAnchor(
  request: SentBrowserRequest,
  delivery: ReceivedBrowserDelivery,
): `0x${string}` {
  return hashCanonical(
    asCanonical({
      chainId: 1952,
      delivery: delivery.envelope,
      request: request.envelope,
      result: delivery.result,
      schemaVersion: "1.0",
    }),
  );
}

export async function verifyLiveEvidenceBundle(value: unknown): Promise<LiveEvidenceVerification> {
  const bundle = parseBundle(value);
  if (bundle === null)
    return { detail: "The live evidence bundle has an invalid shape.", ok: false };

  const [requestValidation, deliveryValidation] = await Promise.all([
    validateEnvelope(bundle.request.envelope),
    validateEnvelope(bundle.delivery.envelope),
  ]);
  if (!requestValidation.ok) {
    return { detail: "The buyer request signature or payload hash is invalid.", ok: false };
  }
  if (!deliveryValidation.ok) {
    return { detail: "The seller delivery signature or payload hash is invalid.", ok: false };
  }

  const request = bundle.request.envelope;
  const delivery = bundle.delivery.envelope;
  if (
    delivery.sessionId !== request.sessionId ||
    delivery.payload.requestMessageId !== request.messageId ||
    delivery.payload.workUnitId !== request.payload.workUnitId ||
    delivery.payload.transactionHash !== request.payload.transactionHash ||
    bundle.result.transactionHash !== request.payload.transactionHash
  ) {
    return { detail: "The request, delivery, and X Layer transaction bindings differ.", ok: false };
  }

  if (hashCanonical(asCanonical(bundle.result)) !== delivery.payload.resultHash) {
    return {
      detail: "The explanation no longer matches the seller-signed result hash.",
      ok: false,
    };
  }

  const expectedAnchorEvidenceHash = hashCanonical(
    asCanonical({
      chainId: 1952,
      delivery: bundle.delivery.envelope,
      request: bundle.request.envelope,
      result: bundle.result,
      schemaVersion: "1.0",
    }),
  );
  if (bundle.anchorEvidenceHash !== expectedAnchorEvidenceHash) {
    return {
      detail: "The evidence anchor hash does not match the stable proof contents.",
      ok: false,
    };
  }

  return { bundle, ok: true };
}
