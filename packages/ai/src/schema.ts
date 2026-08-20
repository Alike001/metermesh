import { normalizedTransactionSchema } from "@metermesh/chain";
import { z } from "zod";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/u);
const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/u);
const hexSchema = z.string().regex(/^0x(?:[a-fA-F0-9]{2})*$/u);

export const aiNarrativeSchema = z.strictObject({
  summary: z.string().min(1).max(500),
  outcome: z.string().min(1).max(500),
  limitations: z.array(z.string().min(1).max(240)).max(4),
});

export const transactionExplanationSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  transactionHash: hashSchema,
  chainId: z.literal(1952),
  chainName: z.literal("X Layer Testnet"),
  status: z.enum(["success", "reverted"]),
  summary: z.string().min(1).max(500),
  outcome: z.string().min(1).max(500),
  financials: z.strictObject({
    valueWei: z.string(),
    valueOkb: z.string(),
    executionFeeWei: z.string(),
    executionFeeOkb: z.string(),
  }),
  call: z.strictObject({
    from: addressSchema,
    to: addressSchema.nullable(),
    createdContract: addressSchema.nullable(),
    inputSelector: z
      .string()
      .regex(/^0x[a-fA-F0-9]{8}$/u)
      .nullable(),
    inputByteLength: z.number().int().nonnegative(),
  }),
  emittedLogs: z.array(
    z.strictObject({
      logIndex: z.number().int().nonnegative().nullable(),
      emitter: addressSchema,
      topic0: hexSchema.nullable(),
      topicCount: z.number().int().nonnegative(),
      dataByteLength: z.number().int().nonnegative(),
      decodedName: z.null(),
    }),
  ),
  failureReason: z.string().nullable(),
  limitations: z.array(z.string().min(1).max(240)).max(6),
  provenance: z.strictObject({
    source: z.literal("x-layer-rpc"),
    blockHash: hashSchema,
    blockNumber: z.string(),
    confirmations: z.string(),
    factsFetchedAt: z.iso.datetime({ offset: true }),
  }),
  generation: z.strictObject({
    provider: z.enum(["groq", "openai"]),
    model: z.string().min(1),
    responseId: z.string().min(1),
    aiAuthoredFields: z.tuple([
      z.literal("summary"),
      z.literal("outcome"),
      z.literal("limitations"),
    ]),
  }),
});

export const explainTransactionInputSchema = z.strictObject({
  facts: normalizedTransactionSchema,
});

export type AiNarrative = z.infer<typeof aiNarrativeSchema>;
export type TransactionExplanation = z.infer<typeof transactionExplanationSchema>;
