import { describe, expect, it } from "vitest";

import { fetchTransactionFacts } from "./x-layer.js";

const knownPublicXLayerTransaction =
  "0xafe21e8d40d641bec6bba559ed40a2289689cab89d306f67c99e0ee38873973f";
const liveTest = process.env.METERMESH_LIVE_X_LAYER === "1" ? it : it.skip;

describe("live X Layer transaction read", () => {
  liveTest(
    "normalizes a real public testnet transaction and receipt",
    async () => {
      const transactionHash =
        process.env.X_LAYER_TEST_TRANSACTION_HASH ?? knownPublicXLayerTransaction;
      const facts = await fetchTransactionFacts(transactionHash);

      expect(facts.transactionHash.toLowerCase()).toBe(transactionHash.toLowerCase());
      expect(facts.chainId).toBe(1952);
      expect(BigInt(facts.confirmations)).toBeGreaterThan(0n);
      expect(BigInt(facts.executionFeeWei)).toBeGreaterThanOrEqual(0n);
      expect(facts.provenance).toBe("x-layer-rpc");
    },
    30_000,
  );
});
