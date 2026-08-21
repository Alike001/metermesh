import {
  getAddress,
  hashTypedData,
  isAddress,
  isHash,
  recoverTypedDataAddress,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";

const DECIMAL_AMOUNT = /^(0|[1-9][0-9]*)$/;
const SIGNATURE = /^0x[0-9a-fA-F]{130}$/;

const addressSchema = z
  .string()
  .refine((value) => isAddress(value), "Invalid EVM address.")
  .transform((value): Address => getAddress(value));
const hashSchema = z
  .string()
  .refine((value) => isHash(value), "Expected a 32-byte hash.")
  .transform((value): Hex => value.toLowerCase() as Hex);
const unsignedAmountSchema = z
  .string()
  .regex(DECIMAL_AMOUNT, "Amount must be an unsigned decimal string.");
const positiveAmountSchema = unsignedAmountSchema.refine(
  (value) => BigInt(value) > 0n,
  "Amount must be greater than zero.",
);
const signatureSchema = z
  .string()
  .regex(SIGNATURE, "Expected a 65-byte EVM signature.")
  .transform((value): Hex => value.toLowerCase() as Hex);

/** The voucher type published by OKX's EVM MPP Session method. */
export const MPP_VOUCHER_TYPES = {
  Voucher: [
    { name: "channelId", type: "bytes32" },
    { name: "cumulativeAmount", type: "uint128" },
  ],
} as const;

export const DEFAULT_MPP_DOMAIN_NAME = "EVM Payment Channel";
export const DEFAULT_MPP_DOMAIN_VERSION = "1";
export const X_LAYER_MAINNET_CHAIN_ID = 196;
export const X_LAYER_TESTNET_CHAIN_ID = 1952;
export const DEFAULT_MPP_ESCROW_CONTRACT = getAddress("0x5E550002e64FaF79B41D89fE8439eEb1be66CE3b");

/** Server-authoritative binding returned by an MPP session open operation. */
export const mppSessionCredentialSchema = z.strictObject({
  action: z.literal("session"),
  authorizedSigner: addressSchema.nullable(),
  cap: positiveAmountSchema,
  chainId: z.number().int().positive(),
  channelId: hashSchema,
  currency: addressSchema,
  escrowContract: addressSchema,
  payer: addressSchema,
  recipient: addressSchema,
  domainName: z.string().min(1).max(96),
  domainVersion: z.string().min(1).max(32),
});

/** The credential payload accepted by the official MPP Session voucher action. */
export const mppVoucherSchema = z.strictObject({
  action: z.literal("voucher"),
  channelId: hashSchema,
  cumulativeAmount: unsignedAmountSchema,
  signature: signatureSchema,
});

export type MppSessionCredential = z.infer<typeof mppSessionCredentialSchema>;
export type MppVoucher = z.infer<typeof mppVoucherSchema>;

export interface MppVerifierPolicy {
  /** The only chain this deployment is willing to verify. Defaults to X Layer mainnet (196). */
  chainId: number;
  /** The escrow contract used in the EIP-712 domain. */
  escrowContract: Address;
  /** Optional exact token binding from the session request. */
  currency?: Address;
  /** Optional exact recipient binding from the session request. */
  recipient?: Address;
  /** Optional exact payer binding from the session authorization. */
  payer?: Address;
  domainName?: string;
  domainVersion?: string;
}

export const DEFAULT_MPP_VERIFIER_POLICY: MppVerifierPolicy = {
  chainId: X_LAYER_MAINNET_CHAIN_ID,
  escrowContract: DEFAULT_MPP_ESCROW_CONTRACT,
  domainName: DEFAULT_MPP_DOMAIN_NAME,
  domainVersion: DEFAULT_MPP_DOMAIN_VERSION,
};

export type MppVerificationCode =
  | "malformed_credential"
  | "malformed_voucher"
  | "unsupported_chain"
  | "chain_mismatch"
  | "escrow_mismatch"
  | "channel_mismatch"
  | "currency_mismatch"
  | "payer_mismatch"
  | "recipient_mismatch"
  | "amount_invalid"
  | "amount_not_increasing"
  | "cap_exceeded"
  | "invalid_signature"
  | "replayed_voucher";

export interface MppReplayGuard {
  /** Atomically records a voucher key and returns false when it already exists. */
  claim(key: string): boolean;
}

/** Suitable for tests and a single worker. Production should provide a durable atomic store. */
export class InMemoryMppReplayGuard implements MppReplayGuard {
  private readonly keys = new Set<string>();

  claim(key: string): boolean {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    return true;
  }
}

export interface MppVerificationSuccess {
  ok: true;
  replayed: boolean;
  signer: Address;
  voucherHash: Hex;
  cumulativeAmount: string;
}

export interface MppVerificationFailure {
  ok: false;
  code: MppVerificationCode;
  message: string;
}

export type MppVerificationResult = MppVerificationSuccess | MppVerificationFailure;

function failure(code: MppVerificationCode, message: string): MppVerificationFailure {
  return { ok: false, code, message };
}

function parseCredential(input: unknown): MppSessionCredential | MppVerificationFailure {
  const parsed = mppSessionCredentialSchema.safeParse(input);
  return parsed.success
    ? parsed.data
    : failure("malformed_credential", "MPP session credential failed its strict schema.");
}

function parseVoucher(input: unknown): MppVoucher | MppVerificationFailure {
  const parsed = mppVoucherSchema.safeParse(input);
  return parsed.success
    ? parsed.data
    : failure("malformed_voucher", "MPP voucher failed its strict schema.");
}

function isFailure(
  value: MppSessionCredential | MppVoucher | MppVerificationFailure,
): value is MppVerificationFailure {
  return "code" in value;
}

function sameAddress(left: Address, right: Address): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Verify one MPP voucher without network calls, wallet mutation, or settlement.
 *
 * The published voucher is cumulative. A durable caller must back `replayGuard`
 * with an atomic unique key such as `(channelId, cumulativeAmount, signature)`.
 * Repeating the exact same accepted voucher is idempotent and cannot increase
 * the amount. A new voucher must be strictly greater than `previousAmount`.
 */
export async function verifyMppVoucher(
  credentialInput: unknown,
  voucherInput: unknown,
  previousAmount: string,
  replayGuard: MppReplayGuard,
  policy: MppVerifierPolicy = DEFAULT_MPP_VERIFIER_POLICY,
): Promise<MppVerificationResult> {
  const credential = parseCredential(credentialInput);
  if (isFailure(credential)) return credential;
  const voucher = parseVoucher(voucherInput);
  if (isFailure(voucher)) return voucher;
  const previousParsed = unsignedAmountSchema.safeParse(previousAmount);
  if (!previousParsed.success) {
    return failure(
      "amount_invalid",
      "Previous cumulative amount must be an unsigned decimal string.",
    );
  }

  if (
    credential.chainId === X_LAYER_TESTNET_CHAIN_ID &&
    policy.chainId !== X_LAYER_TESTNET_CHAIN_ID
  ) {
    return failure(
      "unsupported_chain",
      "OKX MPP session settlement on X Layer Testnet chain 1952 is not confirmed and remains gated.",
    );
  }
  if (credential.chainId !== policy.chainId) {
    return failure(
      "chain_mismatch",
      `Credential chain ${String(credential.chainId)} does not match verifier policy chain ${String(policy.chainId)}.`,
    );
  }
  if (!sameAddress(credential.escrowContract, policy.escrowContract)) {
    return failure(
      "escrow_mismatch",
      "Credential escrow does not match the configured MPP escrow.",
    );
  }
  if (policy.currency !== undefined && !sameAddress(credential.currency, policy.currency)) {
    return failure("currency_mismatch", "Credential currency does not match the configured token.");
  }
  if (policy.recipient !== undefined && !sameAddress(credential.recipient, policy.recipient)) {
    return failure(
      "recipient_mismatch",
      "Credential recipient does not match the configured payee.",
    );
  }
  if (policy.payer !== undefined && !sameAddress(credential.payer, policy.payer)) {
    return failure("payer_mismatch", "Credential payer does not match the configured payer.");
  }
  if (credential.channelId !== voucher.channelId) {
    return failure("channel_mismatch", "Voucher channel does not match the session credential.");
  }

  const amount = BigInt(voucher.cumulativeAmount);
  const previous = BigInt(previousParsed.data);
  const cap = BigInt(credential.cap);
  if (amount > (1n << 128n) - 1n) {
    return failure("amount_invalid", "Voucher amount does not fit the published uint128 field.");
  }
  if (amount > cap) return failure("cap_exceeded", "Voucher exceeds the session credential cap.");
  if (amount < previous) {
    return failure("amount_not_increasing", "Cumulative voucher amount moved backwards.");
  }

  const expectedSigner = credential.authorizedSigner ?? credential.payer;
  let signer: Address;
  try {
    signer = await recoverTypedDataAddress({
      domain: {
        name: policy.domainName ?? DEFAULT_MPP_DOMAIN_NAME,
        version: policy.domainVersion ?? DEFAULT_MPP_DOMAIN_VERSION,
        chainId: credential.chainId,
        verifyingContract: credential.escrowContract,
      },
      types: MPP_VOUCHER_TYPES,
      primaryType: "Voucher",
      message: {
        channelId: credential.channelId,
        cumulativeAmount: amount,
      },
      signature: voucher.signature,
    });
  } catch {
    return failure("invalid_signature", "Voucher signature could not be recovered.");
  }
  if (!sameAddress(signer, expectedSigner)) {
    return failure(
      "invalid_signature",
      "Voucher signer is not the session payer or authorized signer.",
    );
  }

  const voucherHash = hashTypedData({
    domain: {
      name: policy.domainName ?? DEFAULT_MPP_DOMAIN_NAME,
      version: policy.domainVersion ?? DEFAULT_MPP_DOMAIN_VERSION,
      chainId: credential.chainId,
      verifyingContract: credential.escrowContract,
    },
    types: MPP_VOUCHER_TYPES,
    primaryType: "Voucher",
    message: {
      channelId: credential.channelId,
      cumulativeAmount: amount,
    },
  });
  const replayKey = `${credential.channelId}:${voucher.cumulativeAmount}:${voucher.signature}`;
  const claimed = replayGuard.claim(replayKey);
  if (!claimed) {
    return {
      cumulativeAmount: voucher.cumulativeAmount,
      ok: true,
      replayed: true,
      signer,
      voucherHash,
    };
  }
  if (amount === previous) {
    return failure(
      "replayed_voucher",
      "A new signature cannot reuse the current cumulative amount.",
    );
  }

  return {
    cumulativeAmount: voucher.cumulativeAmount,
    ok: true,
    replayed: false,
    signer,
    voucherHash,
  };
}

/** A helper for UI/docs to state the current MPP posture without implying settlement. */
export function mppSettlementStatus(chainId: number): "gated" | "ready_for_official_support" {
  return chainId === X_LAYER_TESTNET_CHAIN_ID ? "gated" : "ready_for_official_support";
}
