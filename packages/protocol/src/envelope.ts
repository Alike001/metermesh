import { verifyMessage, type Address, type Hex } from "viem";

import { hashCanonical, type CanonicalValue } from "./canonical.js";
import {
  envelopeDraftSchema,
  envelopeSchema,
  unsignedEnvelopeSchema,
  type Envelope,
  type EnvelopeDraft,
  type UnsignedEnvelope,
} from "./schema.js";

export interface MessageSigner {
  address: Address;
  signMessage(args: { message: { raw: Hex } }): Promise<Hex>;
}

export type EnvelopeValidationError =
  | { code: "invalid_schema"; issues: string[] }
  | { actual: Hex; code: "payload_hash_mismatch"; expected: Hex }
  | { code: "invalid_signature" };

export type EnvelopeValidationResult =
  { envelope: Envelope; ok: true } | { error: EnvelopeValidationError; ok: false };

function asCanonical(value: unknown): CanonicalValue {
  return value as CanonicalValue;
}

export function buildUnsignedEnvelope(draft: EnvelopeDraft): UnsignedEnvelope {
  const parsedDraft = envelopeDraftSchema.parse(draft);
  return unsignedEnvelopeSchema.parse({
    ...parsedDraft,
    payloadHash: hashCanonical(asCanonical(parsedDraft.payload)),
  });
}

export function envelopeSigningDigest(envelope: UnsignedEnvelope): Hex {
  return hashCanonical(asCanonical(unsignedEnvelopeSchema.parse(envelope)));
}

export async function signEnvelope(draft: EnvelopeDraft, signer: MessageSigner): Promise<Envelope> {
  const unsigned = buildUnsignedEnvelope(draft);
  const signature = await signer.signMessage({
    message: { raw: envelopeSigningDigest(unsigned) },
  });
  return envelopeSchema.parse({
    ...unsigned,
    signature: {
      scheme: "eip191",
      signer: signer.address,
      value: signature,
    },
  });
}

export async function validateEnvelope(input: unknown): Promise<EnvelopeValidationResult> {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: {
        code: "invalid_schema",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      ok: false,
    };
  }

  const envelope = parsed.data;
  const actualPayloadHash = hashCanonical(asCanonical(envelope.payload));
  if (actualPayloadHash !== envelope.payloadHash) {
    return {
      error: {
        actual: actualPayloadHash,
        code: "payload_hash_mismatch",
        expected: envelope.payloadHash,
      },
      ok: false,
    };
  }

  const { signature, ...unsignedInput } = envelope;
  const unsigned = unsignedEnvelopeSchema.parse(unsignedInput);
  let valid: boolean;
  try {
    valid = await verifyMessage({
      address: signature.signer,
      message: { raw: envelopeSigningDigest(unsigned) },
      signature: signature.value,
    });
  } catch {
    return { error: { code: "invalid_signature" }, ok: false };
  }

  if (!valid) {
    return { error: { code: "invalid_signature" }, ok: false };
  }

  return { envelope, ok: true };
}
