import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_MPP_DOMAIN_NAME,
  DEFAULT_MPP_DOMAIN_VERSION,
  DEFAULT_MPP_ESCROW_CONTRACT,
  InMemoryMppReplayGuard,
  MPP_VOUCHER_TYPES,
  X_LAYER_TESTNET_CHAIN_ID,
  verifyMppVoucher,
  type MppSessionCredential,
  type MppVerifierPolicy,
} from "./verifier.js";

const payer = privateKeyToAccount(generatePrivateKey());
const recipient = "0x1000000000000000000000000000000000000001" as const;
const currency = "0x2000000000000000000000000000000000000002" as const;
const channelId = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const baseCredential: MppSessionCredential = {
  action: "session",
  authorizedSigner: null,
  cap: "1000",
  chainId: 196,
  channelId,
  currency,
  domainName: DEFAULT_MPP_DOMAIN_NAME,
  domainVersion: DEFAULT_MPP_DOMAIN_VERSION,
  escrowContract: DEFAULT_MPP_ESCROW_CONTRACT,
  payer: payer.address,
  recipient,
};
const policy: MppVerifierPolicy = {
  chainId: 196,
  currency,
  escrowContract: DEFAULT_MPP_ESCROW_CONTRACT,
  payer: payer.address,
  recipient,
};

async function voucher(amount: string, chainId = 196) {
  return {
    action: "voucher" as const,
    channelId,
    cumulativeAmount: amount,
    signature: await payer.signTypedData({
      domain: {
        name: DEFAULT_MPP_DOMAIN_NAME,
        version: DEFAULT_MPP_DOMAIN_VERSION,
        chainId,
        verifyingContract: DEFAULT_MPP_ESCROW_CONTRACT,
      },
      types: MPP_VOUCHER_TYPES,
      primaryType: "Voucher",
      message: { channelId, cumulativeAmount: BigInt(amount) },
    }),
  };
}

describe("deterministic gated MPP voucher verifier", () => {
  it("accepts the published EIP-712 voucher shape and returns a stable hash", async () => {
    const guard = new InMemoryMppReplayGuard();
    const result = await verifyMppVoucher(baseCredential, await voucher("250"), "0", guard, policy);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.replayed).toBe(false);
      expect(result.signer).toBe(payer.address);
      expect(result.voucherHash).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });

  it("makes a repeated voucher idempotent without counting it twice", async () => {
    const guard = new InMemoryMppReplayGuard();
    const signed = await voucher("250");
    const first = await verifyMppVoucher(baseCredential, signed, "0", guard, policy);
    const retry = await verifyMppVoucher(baseCredential, signed, "250", guard, policy);

    expect(first.ok).toBe(true);
    expect(retry).toMatchObject({ ok: true, replayed: true, cumulativeAmount: "250" });
  });

  it("rejects a different signature that tries to reuse the current amount", async () => {
    const guard = new InMemoryMppReplayGuard();
    const first = await verifyMppVoucher(baseCredential, await voucher("250"), "0", guard, policy);
    const secondPayer = privateKeyToAccount(generatePrivateKey());
    const differentSignature = {
      ...(await voucher("250")),
      signature: await secondPayer.signTypedData({
        domain: {
          name: DEFAULT_MPP_DOMAIN_NAME,
          version: DEFAULT_MPP_DOMAIN_VERSION,
          chainId: 196,
          verifyingContract: DEFAULT_MPP_ESCROW_CONTRACT,
        },
        types: MPP_VOUCHER_TYPES,
        primaryType: "Voucher",
        message: { channelId, cumulativeAmount: 250n },
      }),
    };

    expect(first.ok).toBe(true);
    const result = await verifyMppVoucher(baseCredential, differentSignature, "250", guard, policy);
    expect(result).toMatchObject({ ok: false, code: "invalid_signature" });
  });

  it("rejects Testnet 1952 before any settlement-capable path can be implied", async () => {
    const guard = new InMemoryMppReplayGuard();
    const testnetCredential = { ...baseCredential, chainId: X_LAYER_TESTNET_CHAIN_ID };
    const result = await verifyMppVoucher(
      testnetCredential,
      await voucher("250", X_LAYER_TESTNET_CHAIN_ID),
      "0",
      guard,
      policy,
    );

    expect(result).toMatchObject({ ok: false, code: "unsupported_chain" });
    expect(guard.claim("should-not-be-used")).toBe(true);
  });

  it("rejects mismatched bindings, backwards amounts, and cap violations", async () => {
    const mismatched = await verifyMppVoucher(
      { ...baseCredential, currency: "0x3000000000000000000000000000000000000003" },
      await voucher("250"),
      "0",
      new InMemoryMppReplayGuard(),
      policy,
    );
    const backwards = await verifyMppVoucher(
      baseCredential,
      await voucher("10"),
      "11",
      new InMemoryMppReplayGuard(),
      policy,
    );
    const overCap = await verifyMppVoucher(
      baseCredential,
      await voucher("1001"),
      "0",
      new InMemoryMppReplayGuard(),
      policy,
    );

    expect(mismatched).toMatchObject({ ok: false, code: "currency_mismatch" });
    expect(backwards).toMatchObject({ ok: false, code: "amount_not_increasing" });
    expect(overCap).toMatchObject({ ok: false, code: "cap_exceeded" });
  });

  it("fails closed on unknown fields and malformed signatures", async () => {
    const malformed = await verifyMppVoucher(
      { ...baseCredential, unexpected: true },
      await voucher("250"),
      "0",
      new InMemoryMppReplayGuard(),
      policy,
    );
    const invalidSignature = await verifyMppVoucher(
      baseCredential,
      { ...(await voucher("250")), signature: `0x${"11".repeat(65)}` },
      "0",
      new InMemoryMppReplayGuard(),
      policy,
    );

    expect(malformed).toMatchObject({ ok: false, code: "malformed_credential" });
    expect(invalidSignature).toMatchObject({ ok: false, code: "invalid_signature" });
  });
});
