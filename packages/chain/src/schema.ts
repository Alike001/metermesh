import { z } from "zod";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/u);
const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/u);
const hexSchema = z.string().regex(/^0x(?:[a-fA-F0-9]{2})*$/u);
const decimalIntegerSchema = z.string().regex(/^(?:0|[1-9][0-9]*)$/u);

export const normalizedLogSchema = z.strictObject({
  logIndex: z.number().int().nonnegative().nullable(),
  address: addressSchema,
  topic0: hexSchema.nullable(),
  topics: z.array(hexSchema),
  dataByteLength: z.number().int().nonnegative(),
});

export const normalizedTransactionSchema = z.strictObject({
  chainId: z.literal(1952),
  chainName: z.literal("X Layer Testnet"),
  transactionHash: hashSchema,
  blockHash: hashSchema,
  blockNumber: decimalIntegerSchema,
  confirmations: decimalIntegerSchema,
  status: z.enum(["success", "reverted"]),
  from: addressSchema,
  to: addressSchema.nullable(),
  createdContract: addressSchema.nullable(),
  valueWei: decimalIntegerSchema,
  valueOkb: z.string(),
  gasUsed: decimalIntegerSchema,
  effectiveGasPriceWei: decimalIntegerSchema,
  executionFeeWei: decimalIntegerSchema,
  executionFeeOkb: z.string(),
  inputSelector: z
    .string()
    .regex(/^0x[a-fA-F0-9]{8}$/u)
    .nullable(),
  inputByteLength: z.number().int().nonnegative(),
  logs: z.array(normalizedLogSchema),
  fetchedAt: z.iso.datetime({ offset: true }),
  provenance: z.literal("x-layer-rpc"),
});

export type NormalizedLog = z.infer<typeof normalizedLogSchema>;
export type NormalizedTransaction = z.infer<typeof normalizedTransactionSchema>;
