import { hashSchema, signEnvelope, type Envelope, type MessageSigner } from "@metermesh/protocol";
import { decodeCarrierMessage, encodeCarrierEnvelope } from "@metermesh/xmtp/codec";
import type {
  Client as BrowserClient,
  DecodedMessage,
  Identifier,
  Signer,
} from "@xmtp/browser-sdk";
import type { EIP1193Provider } from "viem";
import type { TransactionExplanation } from "@metermesh/ai";

const consentStates = [0, 1] as const;
const defaultTimeoutMs = 60_000;
const defaultPollIntervalMs = 1_500;

export const METER_MESH_SELLER_INBOX_ID =
  "36ba4d5f9a5cd2cd3b23f46b27f1173edd9c33458a818095004a26cc1a91e6f1";

export type BrowserXmtpFailureCode =
  | "delivery_timeout"
  | "invalid_sequence"
  | "invalid_request"
  | "request_denied"
  | "trial_capacity_reached"
  | "trial_wallet_used"
  | "wallet_missing"
  | "wallet_rejected"
  | "work_failed"
  | "xmtp_connect_failed"
  | "xmtp_send_failed";

export class BrowserXmtpError extends Error {
  constructor(
    readonly code: BrowserXmtpFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BrowserXmtpError";
  }
}

export interface SentBrowserRequest {
  carrierMessageId: string;
  envelope: Extract<Envelope, { type: "work.request" }>;
}

export interface ReceivedBrowserDelivery {
  carrierMessageId: string;
  envelope: Extract<Envelope, { type: "work.delivery" }>;
  result: TransactionExplanation;
}

export interface BrowserXmtpConnection {
  address: `0x${string}`;
  close(): void;
  inboxId: string;
  sendRequest(transactionHash: string): Promise<SentBrowserRequest>;
  waitForDelivery(
    request: SentBrowserRequest,
    options?: { pollIntervalMs?: number; timeoutMs?: number },
  ): Promise<ReceivedBrowserDelivery>;
}

interface CreateBrowserXmtpConnectionOptions {
  provider?: EIP1193Provider;
  sellerInboxId?: string;
}

function browserProvider(): EIP1193Provider | undefined {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}

function messageSigner(
  address: `0x${string}`,
  signMessage: (message: string | { raw: `0x${string}` }) => Promise<`0x${string}`>,
): MessageSigner {
  return {
    address,
    signMessage: ({ message }) => signMessage(message),
  };
}

function isUserRejection(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === 4001 || error.code === "ACTION_REJECTED")
  );
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, error: Error): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

function isSellerAddressAuthorized(
  states: Awaited<ReturnType<BrowserClient["preferences"]["fetchInboxStates"]>>,
  inboxId: string,
  address: string,
): boolean {
  const state = states.find((candidate) => candidate.inboxId === inboxId);
  return (
    state?.accountIdentifiers.some(
      (identifier) => identifier.identifier.toLowerCase() === address.toLowerCase(),
    ) ?? false
  );
}

function toCarrierTextMessage(message: DecodedMessage): {
  content: string;
  id: string;
  senderInboxId: string;
} | null {
  return typeof message.content === "string"
    ? { content: message.content, id: message.id, senderInboxId: message.senderInboxId }
    : null;
}

export async function createBrowserXmtpConnection(
  options: CreateBrowserXmtpConnectionOptions = {},
): Promise<BrowserXmtpConnection> {
  const provider = options.provider ?? browserProvider();
  if (provider === undefined) {
    throw new BrowserXmtpError(
      "wallet_missing",
      "Install or open an EVM wallet extension before connecting to XMTP.",
    );
  }

  const sellerInboxId = options.sellerInboxId ?? METER_MESH_SELLER_INBOX_ID;
  const [{ Client }, { createWalletClient, custom, hexToBytes }] = await Promise.all([
    import("@xmtp/browser-sdk"),
    import("viem"),
  ]);
  const wallet = createWalletClient({ transport: custom(provider) });

  let address: `0x${string}`;
  try {
    const [connectedAddress] = await wallet.requestAddresses();
    if (connectedAddress === undefined) {
      throw new BrowserXmtpError("wallet_missing", "The wallet returned no connected account.");
    }
    address = connectedAddress;
  } catch (error) {
    if (error instanceof BrowserXmtpError) throw error;
    if (isUserRejection(error)) {
      throw new BrowserXmtpError("wallet_rejected", "The wallet connection request was declined.", {
        cause: error,
      });
    }
    throw new BrowserXmtpError("xmtp_connect_failed", "The wallet could not connect to XMTP.", {
      cause: error,
    });
  }

  const signWithWallet = async (message: string | { raw: `0x${string}` }): Promise<`0x${string}`> =>
    wallet.signMessage({ account: address, message });
  const signer: Signer = {
    getIdentifier: (): Identifier => ({
      identifier: address.toLowerCase(),
      identifierKind: 0,
    }),
    signMessage: async (message) => hexToBytes(await signWithWallet(message)),
    type: "EOA",
  };

  let client: BrowserClient;
  try {
    const clientOptions = {
      appVersion: "metermesh-web/0.1.0",
      dbPath: `metermesh-dev-${address.toLowerCase()}.db3`,
      env: "dev" as const,
    };
    client = await withTimeout(
      Client.create(signer, clientOptions),
      90_000,
      new BrowserXmtpError("xmtp_connect_failed", "XMTP connection timed out."),
    );
  } catch (error) {
    if (isUserRejection(error)) {
      throw new BrowserXmtpError(
        "wallet_rejected",
        "The XMTP registration signature was declined.",
        { cause: error },
      );
    }
    throw new BrowserXmtpError("xmtp_connect_failed", "XMTP could not create the buyer inbox.", {
      cause: error,
    });
  }
  const inboxId = client.inboxId;
  if (inboxId === undefined) {
    client.close();
    throw new BrowserXmtpError("xmtp_connect_failed", "XMTP returned no buyer inbox ID.");
  }

  return {
    address,
    close: () => {
      client.close();
    },
    inboxId,
    async sendRequest(transactionHash) {
      let parsedHash: `0x${string}`;
      try {
        parsedHash = hashSchema.parse(transactionHash);
      } catch (error) {
        throw new BrowserXmtpError(
          "invalid_request",
          "Enter a complete 32-byte X Layer transaction hash.",
          { cause: error },
        );
      }

      try {
        return await withTimeout(
          (async () => {
            const requestId = newId("request");
            const signedEnvelope = await signEnvelope(
              {
                createdAt: new Date().toISOString(),
                messageId: requestId,
                payload: {
                  transactionHash: parsedHash,
                  workUnitId: newId("work"),
                },
                protocol: "metermesh",
                senderInboxId: inboxId,
                sequence: 1,
                sessionId: newId("transport"),
                type: "work.request",
                version: 1,
              },
              messageSigner(address, signWithWallet),
            );
            if (signedEnvelope.type !== "work.request") {
              throw new BrowserXmtpError(
                "invalid_request",
                "XMTP created an unexpected request type.",
              );
            }
            const conversation = await client.conversations.createDm(sellerInboxId);
            const carrierMessageId = await conversation.sendText(
              encodeCarrierEnvelope(signedEnvelope),
              { idempotencyKey: signedEnvelope.messageId },
            );
            return { carrierMessageId, envelope: signedEnvelope };
          })(),
          45_000,
          new BrowserXmtpError("xmtp_send_failed", "The XMTP send operation timed out."),
        );
      } catch (error) {
        if (error instanceof BrowserXmtpError) throw error;
        throw new BrowserXmtpError(
          "xmtp_send_failed",
          "The request could not be sent through XMTP.",
          { cause: error },
        );
      }
    },
    async waitForDelivery(request, waitOptions = {}) {
      const timeoutMs = waitOptions.timeoutMs ?? defaultTimeoutMs;
      const pollIntervalMs = waitOptions.pollIntervalMs ?? defaultPollIntervalMs;
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        try {
          await withTimeout(
            client.conversations.syncAll([...consentStates]),
            15_000,
            new Error("XMTP synchronization timed out."),
          );
          const conversation = await client.conversations.getDmByInboxId(sellerInboxId);
          if (conversation !== undefined) {
            await withTimeout(
              conversation.sync(),
              15_000,
              new Error("XMTP conversation synchronization timed out."),
            );
            const messages = await conversation.messages();
            for (const message of messages.toReversed()) {
              if (message.senderInboxId.toLowerCase() !== sellerInboxId.toLowerCase()) continue;
              const carrierMessage = toCarrierTextMessage(message);
              if (carrierMessage === null) continue;
              const decoded = await decodeCarrierMessage(carrierMessage, {
                isSignerAuthorized: async (senderInboxId, signerAddress) =>
                  isSellerAddressAuthorized(
                    await withTimeout(
                      client.preferences.fetchInboxStates([senderInboxId]),
                      15_000,
                      new Error("XMTP identity lookup timed out."),
                    ),
                    senderInboxId,
                    signerAddress,
                  ),
              });
              if (
                decoded.ok &&
                decoded.envelope.type === "work.error" &&
                decoded.envelope.sessionId === request.envelope.sessionId &&
                decoded.envelope.payload.requestMessageId === request.envelope.messageId &&
                decoded.envelope.payload.transactionHash ===
                  request.envelope.payload.transactionHash &&
                decoded.envelope.payload.workUnitId === request.envelope.payload.workUnitId
              ) {
                throw new BrowserXmtpError(
                  decoded.envelope.payload.code,
                  decoded.envelope.payload.detail,
                );
              }
              if (
                decoded.ok &&
                decoded.envelope.type === "work.delivery" &&
                decoded.result !== null &&
                decoded.envelope.sessionId === request.envelope.sessionId &&
                decoded.envelope.payload.requestMessageId === request.envelope.messageId
              ) {
                return {
                  carrierMessageId: message.id,
                  envelope: decoded.envelope,
                  result: decoded.result,
                };
              }
            }
          }
        } catch (error) {
          if (error instanceof BrowserXmtpError) throw error;
          // A bounded transient sync failure is retried until the overall delivery deadline.
        }
        await delay(pollIntervalMs);
      }
      throw new BrowserXmtpError(
        "delivery_timeout",
        "The seller did not return a verified delivery before the wait window ended.",
      );
    },
  };
}
