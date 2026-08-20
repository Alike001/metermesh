import { transactionExplanationSchema, type TransactionExplanation } from "@metermesh/ai";
import {
  canonicalize,
  hashCanonical,
  validateEnvelope,
  type CanonicalValue,
  type Envelope,
} from "@metermesh/protocol";

export const METER_MESH_CONTENT_PREFIX = "metermesh:1:";
export const MAX_METER_MESH_CONTENT_BYTES = 64 * 1024;

export type CarrierDecodeFailureCode =
  | "content_too_large"
  | "invalid_json"
  | "invalid_protocol_content"
  | "invalid_protocol_envelope"
  | "sender_inbox_mismatch"
  | "signer_not_authorized";

export type CarrierDecodeResult =
  | {
      envelope: Envelope;
      ok: true;
      result: TransactionExplanation | null;
    }
  | { code: CarrierDecodeFailureCode; detail: string; ok: false };

export interface CarrierTextMessage {
  content: string;
  id: string;
  senderInboxId: string;
}

export interface DecodeCarrierMessageOptions {
  isSignerAuthorized: (inboxId: string, signerAddress: string) => Promise<boolean>;
}

export type InspectedCarrierTextMessage =
  | {
      carrierMessageId: string;
      envelope: Envelope;
      result: TransactionExplanation | null;
      status: "accepted";
    }
  | { carrierMessageId: string; status: "duplicate" }
  | {
      carrierMessageId: string;
      code: CarrierDecodeFailureCode;
      detail: string;
      senderInboxId: string;
      status: "rejected";
    };

function asCanonical(value: unknown): CanonicalValue {
  return value as CanonicalValue;
}

function validateDeliveryResult(
  envelope: Envelope,
  result: unknown,
): TransactionExplanation | null {
  if (envelope.type !== "work.delivery") {
    if (result !== undefined && result !== null) {
      throw new TypeError("Only work.delivery content may carry an explanation result.");
    }
    return null;
  }

  const explanation = transactionExplanationSchema.parse(result);
  if (
    explanation.transactionHash.toLowerCase() !== envelope.payload.transactionHash.toLowerCase()
  ) {
    throw new TypeError("Delivery explanation transaction hash does not match its envelope.");
  }
  const actualResultHash = hashCanonical(asCanonical(explanation));
  if (actualResultHash !== envelope.payload.resultHash) {
    throw new TypeError("Delivery explanation hash does not match its signed envelope.");
  }
  return explanation;
}

export function encodeCarrierEnvelope(envelope: Envelope, result?: TransactionExplanation): string {
  const validatedResult = validateDeliveryResult(envelope, result);
  const content = validatedResult === null ? { envelope } : { envelope, result: validatedResult };
  return `${METER_MESH_CONTENT_PREFIX}${canonicalize(asCanonical(content))}`;
}

function contentByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function parseWireRecord(input: unknown): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length < 1 ||
    keys.length > 2 ||
    keys[0] !== "envelope" ||
    (keys.length === 2 && keys[1] !== "result")
  ) {
    return null;
  }
  return record;
}

export async function decodeCarrierMessage(
  message: CarrierTextMessage,
  options: DecodeCarrierMessageOptions,
): Promise<CarrierDecodeResult> {
  if (contentByteLength(message.content) > MAX_METER_MESH_CONTENT_BYTES) {
    return {
      code: "content_too_large",
      detail: "XMTP content exceeds the MeterMesh 64 KiB envelope limit.",
      ok: false,
    };
  }
  if (!message.content.startsWith(METER_MESH_CONTENT_PREFIX)) {
    return {
      code: "invalid_protocol_content",
      detail: "XMTP content does not declare MeterMesh protocol version 1.",
      ok: false,
    };
  }

  let input: unknown;
  try {
    input = JSON.parse(message.content.slice(METER_MESH_CONTENT_PREFIX.length)) as unknown;
  } catch {
    return { code: "invalid_json", detail: "XMTP content is not valid JSON.", ok: false };
  }

  const wireRecord = parseWireRecord(input);
  if (wireRecord === null) {
    return {
      code: "invalid_protocol_content",
      detail: "MeterMesh content contains unexpected or missing fields.",
      ok: false,
    };
  }

  const validation = await validateEnvelope(wireRecord.envelope);
  if (!validation.ok) {
    return {
      code: "invalid_protocol_envelope",
      detail: `Envelope validation failed: ${validation.error.code}.`,
      ok: false,
    };
  }

  const { envelope } = validation;
  let result: TransactionExplanation | null;
  try {
    result = validateDeliveryResult(envelope, wireRecord.result);
  } catch (error) {
    return {
      code: "invalid_protocol_content",
      detail: error instanceof Error ? error.message : "Delivery result is invalid.",
      ok: false,
    };
  }

  if (envelope.senderInboxId.toLowerCase() !== message.senderInboxId.toLowerCase()) {
    return {
      code: "sender_inbox_mismatch",
      detail: "Signed envelope sender does not match the XMTP sender inbox.",
      ok: false,
    };
  }
  if (!(await options.isSignerAuthorized(message.senderInboxId, envelope.signature.signer))) {
    return {
      code: "signer_not_authorized",
      detail: "Envelope signer is not authorized for the XMTP sender inbox.",
      ok: false,
    };
  }
  return { envelope, ok: true, result };
}

export async function inspectCarrierTextMessages(
  messages: readonly CarrierTextMessage[],
  options: DecodeCarrierMessageOptions & { seenCarrierMessageIds?: ReadonlySet<string> },
): Promise<InspectedCarrierTextMessage[]> {
  const seen = new Set(options.seenCarrierMessageIds);
  return Promise.all(
    messages.map(async (message): Promise<InspectedCarrierTextMessage> => {
      if (seen.has(message.id)) return { carrierMessageId: message.id, status: "duplicate" };
      seen.add(message.id);
      const result = await decodeCarrierMessage(message, options);
      if (!result.ok) {
        return {
          carrierMessageId: message.id,
          code: result.code,
          detail: result.detail,
          senderInboxId: message.senderInboxId,
          status: "rejected",
        };
      }
      return {
        carrierMessageId: message.id,
        envelope: result.envelope,
        result: result.result,
        status: "accepted",
      };
    }),
  );
}
