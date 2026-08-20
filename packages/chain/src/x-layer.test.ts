import { TransactionNotFoundError, TransactionReceiptNotFoundError } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  ChainReadError,
  fetchTransactionFacts,
  getXLayerRpcUrl,
  type XLayerReadClient,
} from "./x-layer.js";

const hash = "0x1111111111111111111111111111111111111111111111111111111111111111";
const blockHash = "0x2222222222222222222222222222222222222222222222222222222222222222";
const from = "0x1111111111111111111111111111111111111111";
const to = "0x2222222222222222222222222222222222222222";
const emitter = "0x3333333333333333333333333333333333333333";
const topic = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function createClient(overrides: Partial<XLayerReadClient> = {}): XLayerReadClient {
  return {
    getChainId: vi.fn().mockResolvedValue(1952),
    getBlockNumber: vi.fn().mockResolvedValue(102n),
    getTransaction: vi.fn().mockResolvedValue({
      hash,
      blockHash,
      blockNumber: 100n,
      from,
      to,
      value: 1_000_000_000_000_000_000n,
      input: "0xa9059cbb00",
    }),
    getTransactionReceipt: vi.fn().mockResolvedValue({
      transactionHash: hash,
      blockHash,
      blockNumber: 100n,
      status: "success",
      gasUsed: 21_000n,
      effectiveGasPrice: 2_000_000_000n,
      contractAddress: null,
      logs: [
        {
          logIndex: 0,
          address: emitter,
          topics: [topic],
          data: "0x1234",
        },
      ],
    }),
    ...overrides,
  };
}

async function expectCode(promise: Promise<unknown>, code: ChainReadError["code"]): Promise<void> {
  await expect(promise).rejects.toMatchObject({ billable: false, code });
}

describe("fetchTransactionFacts", () => {
  it("normalizes authoritative transaction and receipt facts", async () => {
    const facts = await fetchTransactionFacts(hash, {
      client: createClient(),
      fetchedAt: () => new Date("2026-08-20T10:00:00.000Z"),
    });

    expect(facts).toMatchObject({
      chainId: 1952,
      status: "success",
      confirmations: "3",
      valueWei: "1000000000000000000",
      valueOkb: "1",
      gasUsed: "21000",
      executionFeeWei: "42000000000000",
      executionFeeOkb: "0.000042",
      inputSelector: "0xa9059cbb",
      inputByteLength: 5,
      fetchedAt: "2026-08-20T10:00:00.000Z",
    });
    expect(facts.logs).toEqual([
      {
        logIndex: 0,
        address: emitter,
        topic0: topic,
        topics: [topic],
        dataByteLength: 2,
      },
    ]);
  });

  it("rejects malformed hashes before calling the client", async () => {
    const getChainId = vi.fn().mockResolvedValue(1952);
    const client = createClient({ getChainId });
    await expectCode(fetchTransactionFacts("0x1234", { client }), "invalid_hash");
    expect(getChainId).not.toHaveBeenCalled();
  });

  it("rejects an RPC connected to the wrong chain", async () => {
    await expectCode(
      fetchTransactionFacts(hash, {
        client: createClient({
          getChainId: vi.fn().mockResolvedValue(196),
        }),
      }),
      "wrong_chain",
    );
  });

  it("maps a missing transaction to a nonbillable failure", async () => {
    await expectCode(
      fetchTransactionFacts(hash, {
        client: createClient({
          getTransaction: vi.fn().mockRejectedValue(new TransactionNotFoundError({ hash })),
        }),
      }),
      "transaction_not_found",
    );
  });

  it("treats a pending transaction as unconfirmed", async () => {
    await expectCode(
      fetchTransactionFacts(hash, {
        client: createClient({
          getTransaction: vi.fn().mockResolvedValue({
            hash,
            blockHash: null,
            blockNumber: null,
            from,
            to,
            value: 0n,
            input: "0x",
          }),
        }),
      }),
      "transaction_unconfirmed",
    );
  });

  it("maps a missing receipt to a nonbillable failure", async () => {
    await expectCode(
      fetchTransactionFacts(hash, {
        client: createClient({
          getTransactionReceipt: vi
            .fn()
            .mockRejectedValue(new TransactionReceiptNotFoundError({ hash })),
        }),
      }),
      "receipt_not_found",
    );
  });

  it("rejects mismatched receipt provenance", async () => {
    await expectCode(
      fetchTransactionFacts(hash, {
        client: createClient({
          getTransactionReceipt: vi.fn().mockResolvedValue({
            transactionHash: hash,
            blockHash: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            blockNumber: 100n,
            status: "reverted",
            gasUsed: 1n,
            effectiveGasPrice: 1n,
            contractAddress: null,
            logs: [],
          }),
        }),
      }),
      "inconsistent_rpc_data",
    );
  });

  it("classifies malformed RPC data as inconsistent rather than unavailable", async () => {
    await expectCode(
      fetchTransactionFacts(hash, {
        client: createClient({
          getTransaction: vi.fn().mockResolvedValue({ hash }),
        }),
      }),
      "inconsistent_rpc_data",
    );
  });
});

describe("getXLayerRpcUrl", () => {
  it("uses the official testnet endpoint when no override exists", () => {
    expect(getXLayerRpcUrl({})).toBe("https://testrpc.xlayer.tech/terigon");
  });

  it("rejects non-HTTP endpoint schemes", () => {
    expect(() => getXLayerRpcUrl({ X_LAYER_RPC_URL: "file:///tmp/rpc" })).toThrow(ChainReadError);
  });

  it("rejects malformed endpoint URLs with a nonbillable chain error", () => {
    expect(() => getXLayerRpcUrl({ X_LAYER_RPC_URL: "not a url" })).toThrow(ChainReadError);
  });
});
