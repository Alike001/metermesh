import type { NormalizedTransaction } from "@metermesh/chain";
import { describe, expect, it, vi } from "vitest";

import { explainTransaction } from "./explain.js";
import type { NarrativeProvider } from "./openai-responses.js";

const facts: NormalizedTransaction = {
  chainId: 1952,
  chainName: "X Layer Testnet",
  transactionHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
  blockHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
  blockNumber: "100",
  confirmations: "3",
  status: "success",
  from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222",
  createdContract: null,
  valueWei: "0",
  valueOkb: "0",
  gasUsed: "21000",
  effectiveGasPriceWei: "2000000000",
  executionFeeWei: "42000000000000",
  executionFeeOkb: "0.000042",
  inputSelector: "0xa9059cbb",
  inputByteLength: 68,
  logs: [
    {
      logIndex: 1,
      address: "0x3333333333333333333333333333333333333333",
      topic0: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      topics: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      dataByteLength: 32,
    },
  ],
  fetchedAt: "2026-08-20T10:00:00.000Z",
  provenance: "x-layer-rpc",
};

function provider(): {
  createNarrative: ReturnType<typeof vi.fn<NarrativeProvider["createNarrative"]>>;
  value: NarrativeProvider;
} {
  const createNarrative = vi.fn<NarrativeProvider["createNarrative"]>().mockResolvedValue({
    narrative: {
      summary: "The transaction completed successfully on X Layer Testnet.",
      outcome: "The called address executed without an EVM-level revert.",
      limitations: ["The user intent is not present in the chain facts."],
    },
    provider: "groq",
    model: "gpt-test",
    responseId: "resp_test",
  });
  return {
    createNarrative,
    value: { createNarrative },
  };
}

describe("explainTransaction", () => {
  it("binds AI prose to deterministic transaction evidence", async () => {
    const narrativeProvider = provider();
    const result = await explainTransaction(facts, {
      model: "requested-model",
      provider: narrativeProvider.value,
    });

    expect(narrativeProvider.createNarrative).toHaveBeenCalledWith({
      factsJson: JSON.stringify(facts),
      model: "requested-model",
    });
    expect(result).toMatchObject({
      transactionHash: facts.transactionHash,
      status: "success",
      failureReason: null,
      financials: {
        executionFeeWei: facts.executionFeeWei,
      },
      provenance: {
        blockHash: facts.blockHash,
        source: "x-layer-rpc",
      },
      generation: {
        provider: "groq",
        model: "gpt-test",
        responseId: "resp_test",
        aiAuthoredFields: ["summary", "outcome", "limitations"],
      },
    });
    expect(result.emittedLogs).toEqual([
      {
        logIndex: 1,
        emitter: facts.logs[0]?.address,
        topic0: facts.logs[0]?.topic0,
        topicCount: 1,
        dataByteLength: 32,
        decodedName: null,
      },
    ]);
  });

  it("states the missing verified reason for a reverted receipt", async () => {
    const result = await explainTransaction(
      { ...facts, status: "reverted" },
      { provider: provider().value },
    );

    expect(result.failureReason).toBeNull();
    expect(result.limitations).toContain(
      "The receipt reports a revert, but the RPC facts do not include a verified revert reason.",
    );
  });

  it("rejects untrusted facts before calling the provider", async () => {
    const narrativeProvider = provider();
    await expect(
      explainTransaction({ ...facts, chainId: 196 } as unknown as NormalizedTransaction, {
        provider: narrativeProvider.value,
      }),
    ).rejects.toThrow();
    expect(narrativeProvider.createNarrative).not.toHaveBeenCalled();
  });
});
