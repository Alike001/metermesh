import { normalizedTransactionSchema, type NormalizedTransaction } from "@metermesh/chain";

import {
  DEFAULT_OPENAI_MODEL,
  createOpenAIResponsesClient,
  type NarrativeProvider,
} from "./openai-responses.js";
import { transactionExplanationSchema, type TransactionExplanation } from "./schema.js";

export interface ExplainTransactionOptions {
  model?: string;
  provider?: NarrativeProvider;
}

function uniqueLimitations(facts: NormalizedTransaction, providerLimitations: string[]): string[] {
  const required = [
    "Contract calldata and event logs are not ABI-decoded, so no function or event names are claimed.",
  ];
  if (facts.status === "reverted") {
    required.push(
      "The receipt reports a revert, but the RPC facts do not include a verified revert reason.",
    );
  }
  return [...new Set([...required, ...providerLimitations])].slice(0, 6);
}

export async function explainTransaction(
  untrustedFacts: NormalizedTransaction,
  options: ExplainTransactionOptions = {},
): Promise<TransactionExplanation> {
  const facts = normalizedTransactionSchema.parse(untrustedFacts);
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const provider = options.provider ?? createOpenAIResponsesClient();
  const generated = await provider.createNarrative({
    factsJson: JSON.stringify(facts),
    model,
  });

  return transactionExplanationSchema.parse({
    schemaVersion: "1",
    transactionHash: facts.transactionHash,
    chainId: facts.chainId,
    chainName: facts.chainName,
    status: facts.status,
    summary: generated.narrative.summary,
    outcome: generated.narrative.outcome,
    financials: {
      valueWei: facts.valueWei,
      valueOkb: facts.valueOkb,
      executionFeeWei: facts.executionFeeWei,
      executionFeeOkb: facts.executionFeeOkb,
    },
    call: {
      from: facts.from,
      to: facts.to,
      createdContract: facts.createdContract,
      inputSelector: facts.inputSelector,
      inputByteLength: facts.inputByteLength,
    },
    emittedLogs: facts.logs.map((log) => ({
      logIndex: log.logIndex,
      emitter: log.address,
      topic0: log.topic0,
      topicCount: log.topics.length,
      dataByteLength: log.dataByteLength,
      decodedName: null,
    })),
    failureReason: null,
    limitations: uniqueLimitations(facts, generated.narrative.limitations),
    provenance: {
      source: facts.provenance,
      blockHash: facts.blockHash,
      blockNumber: facts.blockNumber,
      confirmations: facts.confirmations,
      factsFetchedAt: facts.fetchedAt,
    },
    generation: {
      provider: "openai",
      model: generated.model,
      responseId: generated.responseId,
      aiAuthoredFields: ["summary", "outcome", "limitations"],
    },
  });
}
