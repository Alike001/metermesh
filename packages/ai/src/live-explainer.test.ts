import { fetchTransactionFacts } from "@metermesh/chain";
import { describe, expect, it } from "vitest";

import { explainTransaction } from "./explain.js";

const knownPublicXLayerTransaction =
  "0xafe21e8d40d641bec6bba559ed40a2289689cab89d306f67c99e0ee38873973f";
const liveTest = process.env.METERMESH_LIVE_EXPLAINER === "1" ? it : it.skip;

describe("live X Layer and OpenAI explainer", () => {
  liveTest(
    "reads a real receipt and returns a provenance-bound explanation",
    async () => {
      const transactionHash =
        process.env.X_LAYER_TEST_TRANSACTION_HASH ?? knownPublicXLayerTransaction;
      const facts = await fetchTransactionFacts(transactionHash);
      const explanation = await explainTransaction(facts);

      expect(explanation.transactionHash.toLowerCase()).toBe(transactionHash.toLowerCase());
      expect(explanation.chainId).toBe(1952);
      expect(explanation.status).toBe(facts.status);
      expect(explanation.provenance.blockHash).toBe(facts.blockHash);
      expect(explanation.generation.provider).toBe("openai");
      expect(explanation.summary.length).toBeGreaterThan(0);
    },
    45_000,
  );
});
