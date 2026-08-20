import {
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  createPublicClient,
  defineChain,
  formatEther,
  http,
  isHash,
  type Hash,
} from "viem";
import { z } from "zod";

import { normalizedTransactionSchema, type NormalizedTransaction } from "./schema.js";

export const X_LAYER_TESTNET_CHAIN_ID = 1952 as const;
export const X_LAYER_TESTNET_RPC_URL = "https://testrpc.xlayer.tech/terigon" as const;

export const xLayerTestnet = defineChain({
  id: X_LAYER_TESTNET_CHAIN_ID,
  name: "X Layer Testnet",
  nativeCurrency: { decimals: 18, name: "OKB", symbol: "OKB" },
  rpcUrls: {
    default: { http: [X_LAYER_TESTNET_RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: "OKLink",
      url: "https://www.okx.com/web3/explorer/xlayer-test",
    },
  },
  testnet: true,
});

const rawTransactionSchema = z.object({
  hash: z.string(),
  blockHash: z.string().nullable(),
  blockNumber: z.bigint().nullable(),
  from: z.string(),
  to: z.string().nullable(),
  value: z.bigint().nonnegative(),
  input: z.string(),
});

const rawReceiptSchema = z.object({
  transactionHash: z.string(),
  blockHash: z.string(),
  blockNumber: z.bigint().nonnegative(),
  status: z.enum(["success", "reverted"]),
  gasUsed: z.bigint().nonnegative(),
  effectiveGasPrice: z.bigint().nonnegative(),
  contractAddress: z.string().nullable(),
  logs: z.array(
    z.object({
      logIndex: z.number().int().nonnegative().nullable(),
      address: z.string(),
      topics: z.array(z.string()),
      data: z.string(),
    }),
  ),
});

export type ChainReadFailureCode =
  | "invalid_hash"
  | "wrong_chain"
  | "transaction_not_found"
  | "transaction_unconfirmed"
  | "receipt_not_found"
  | "inconsistent_rpc_data"
  | "rpc_unavailable";

export class ChainReadError extends Error {
  readonly billable = false;

  constructor(
    readonly code: ChainReadFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ChainReadError";
  }
}

export interface XLayerReadClient {
  getBlockNumber(): Promise<bigint>;
  getChainId(): Promise<number>;
  getTransaction(parameters: { hash: Hash }): Promise<unknown>;
  getTransactionReceipt(parameters: { hash: Hash }): Promise<unknown>;
}

export interface FetchTransactionFactsOptions {
  client?: XLayerReadClient;
  fetchedAt?: () => Date;
  rpcUrl?: string;
}

function byteLength(hex: string): number {
  return Math.max(0, (hex.length - 2) / 2);
}

function asChainReadError(error: unknown, hash: Hash): ChainReadError {
  if (error instanceof ChainReadError) return error;
  if (error instanceof z.ZodError) {
    return new ChainReadError(
      "inconsistent_rpc_data",
      "The X Layer RPC returned transaction data outside the expected shape.",
      { cause: error },
    );
  }
  if (error instanceof TransactionNotFoundError) {
    return new ChainReadError(
      "transaction_not_found",
      `Transaction ${hash} was not found on X Layer Testnet.`,
      { cause: error },
    );
  }
  if (error instanceof TransactionReceiptNotFoundError) {
    return new ChainReadError(
      "receipt_not_found",
      `Transaction ${hash} does not have a confirmed receipt yet.`,
      { cause: error },
    );
  }
  return new ChainReadError(
    "rpc_unavailable",
    "X Layer transaction facts could not be read from the configured RPC.",
    { cause: error },
  );
}

export function getXLayerRpcUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment.X_LAYER_RPC_URL?.trim();
  if (!configured) return X_LAYER_TESTNET_RPC_URL;

  let url: URL;
  try {
    url = new URL(configured);
  } catch (error) {
    throw new ChainReadError("rpc_unavailable", "X_LAYER_RPC_URL must be a valid URL.", {
      cause: error,
    });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ChainReadError("rpc_unavailable", "X_LAYER_RPC_URL must use HTTP or HTTPS.");
  }
  return url.toString();
}

export function createXLayerReadClient(rpcUrl = getXLayerRpcUrl()): XLayerReadClient {
  const client = createPublicClient({
    chain: xLayerTestnet,
    transport: http(rpcUrl, { retryCount: 2, timeout: 10_000 }),
  });

  return {
    getBlockNumber: () => client.getBlockNumber(),
    getChainId: () => client.getChainId(),
    getTransaction: ({ hash }) => client.getTransaction({ hash }),
    getTransactionReceipt: ({ hash }) => client.getTransactionReceipt({ hash }),
  };
}

export async function fetchTransactionFacts(
  transactionHash: string,
  options: FetchTransactionFactsOptions = {},
): Promise<NormalizedTransaction> {
  if (!isHash(transactionHash)) {
    throw new ChainReadError(
      "invalid_hash",
      "Transaction hash must be 32 bytes of hexadecimal data.",
    );
  }

  const hash = transactionHash;
  const client = options.client ?? createXLayerReadClient(options.rpcUrl ?? getXLayerRpcUrl());

  try {
    const chainId = await client.getChainId();
    if (chainId !== X_LAYER_TESTNET_CHAIN_ID) {
      throw new ChainReadError(
        "wrong_chain",
        `Configured RPC returned chain ${String(chainId)}, expected ${String(X_LAYER_TESTNET_CHAIN_ID)}.`,
      );
    }

    const transaction = rawTransactionSchema.parse(await client.getTransaction({ hash }));
    if (transaction.blockHash === null || transaction.blockNumber === null) {
      throw new ChainReadError(
        "transaction_unconfirmed",
        `Transaction ${hash} has not been included in a block.`,
      );
    }

    const receipt = rawReceiptSchema.parse(await client.getTransactionReceipt({ hash }));
    if (
      transaction.hash.toLowerCase() !== hash.toLowerCase() ||
      receipt.transactionHash.toLowerCase() !== hash.toLowerCase() ||
      transaction.blockHash.toLowerCase() !== receipt.blockHash.toLowerCase() ||
      transaction.blockNumber !== receipt.blockNumber
    ) {
      throw new ChainReadError(
        "inconsistent_rpc_data",
        "The X Layer transaction and receipt provenance did not match.",
      );
    }

    const latestBlock = await client.getBlockNumber();
    if (latestBlock < receipt.blockNumber) {
      throw new ChainReadError(
        "inconsistent_rpc_data",
        "The X Layer RPC reported a latest block below the receipt block.",
      );
    }

    const executionFee = receipt.gasUsed * receipt.effectiveGasPrice;
    const inputSelector = transaction.input.length >= 10 ? transaction.input.slice(0, 10) : null;

    return normalizedTransactionSchema.parse({
      chainId: X_LAYER_TESTNET_CHAIN_ID,
      chainName: "X Layer Testnet",
      transactionHash: hash,
      blockHash: receipt.blockHash,
      blockNumber: receipt.blockNumber.toString(),
      confirmations: (latestBlock - receipt.blockNumber + 1n).toString(),
      status: receipt.status,
      from: transaction.from,
      to: transaction.to,
      createdContract: receipt.contractAddress,
      valueWei: transaction.value.toString(),
      valueOkb: formatEther(transaction.value),
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPriceWei: receipt.effectiveGasPrice.toString(),
      executionFeeWei: executionFee.toString(),
      executionFeeOkb: formatEther(executionFee),
      inputSelector,
      inputByteLength: byteLength(transaction.input),
      logs: receipt.logs.map((log) => ({
        logIndex: log.logIndex,
        address: log.address,
        topic0: log.topics[0] ?? null,
        topics: log.topics,
        dataByteLength: byteLength(log.data),
      })),
      fetchedAt: (options.fetchedAt ?? (() => new Date()))().toISOString(),
      provenance: "x-layer-rpc",
    });
  } catch (error) {
    throw asChainReadError(error, hash);
  }
}
