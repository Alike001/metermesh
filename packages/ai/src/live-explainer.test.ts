import { fetchTransactionFacts } from "@metermesh/chain";
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { explainTransaction } from "./explain.js";

const knownPublicXLayerTransaction =
  "0xafe21e8d40d641bec6bba559ed40a2289689cab89d306f67c99e0ee38873973f";
const liveTest = process.env.METERMESH_LIVE_EXPLAINER === "1" ? it : it.skip;

describe("live X Layer and Groq explainer", () => {
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
      expect(explanation.generation.provider).toBe("groq");
      expect(explanation.summary.length).toBeGreaterThan(0);

      const outputPath = process.env.METERMESH_LIVE_EXPLANATION_OUTPUT?.trim();
      if (outputPath !== undefined && outputPath !== "") {
        const evidence = {
          capturedAt: new Date().toISOString(),
          chainId: 1952,
          explanation,
          facts,
          kind: "live-reverted-explanation",
          meterMeshFundsMoved: false,
          schemaVersion: "1.0",
          source: "x-layer-rpc+groq",
          transactionHash,
          verification: {
            blockBindingMatches: explanation.provenance.blockHash === facts.blockHash,
            explanationStatusMatchesReceipt: explanation.status === facts.status,
            receiptStatus: facts.status,
            transactionBindingMatches:
              explanation.transactionHash.toLowerCase() === facts.transactionHash.toLowerCase(),
            unknownReasonPreserved:
              facts.status !== "reverted" ||
              explanation.limitations.includes(
                "The receipt reports a revert, but the RPC facts do not include a verified revert reason.",
              ),
          },
          voucherSigned: false,
        };
        await writeFile(outputPath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
      }
    },
    45_000,
  );
});
