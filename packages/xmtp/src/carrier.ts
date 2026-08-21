import { chmod, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import {
  type Backend,
  Client,
  createBackend,
  isText,
  type AsyncStreamProxy,
  type ConsentState,
  type DecodedMessage,
} from "@xmtp/node-sdk";
import type { TransactionExplanation } from "@metermesh/ai";
import type { Envelope } from "@metermesh/protocol";

import type { MeterMeshXmtpConfig } from "./config.js";
import {
  encodeCarrierEnvelope,
  inspectCarrierTextMessages,
  type CarrierDecodeFailureCode,
  type CarrierTextMessage,
} from "./codec.js";
import { createMeterMeshIdentity } from "./signer.js";

// XMTP exposes these consent values as ambient const enums. Keeping the numeric
// wire values avoids runtime enum access under verbatimModuleSyntax.
const consentStates = [0, 1] as ConsentState[];

async function chmodIfPresent(path: string, mode: number): Promise<void> {
  try {
    await chmod(path, mode);
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

export async function secureXmtpDatabasePath(dbPath: string): Promise<void> {
  await chmod(dirname(dbPath), 0o700);
  await Promise.all(
    [dbPath, `${dbPath}-shm`, `${dbPath}-wal`, `${dbPath}.sqlcipher_salt`].map((path) =>
      chmodIfPresent(path, 0o600),
    ),
  );
}

export interface AcceptedCarrierEnvelope {
  carrierMessageId: string;
  envelope: Envelope;
  result: TransactionExplanation | null;
  sentAt: Date;
  sentAtNs: bigint;
  status: "accepted";
}

export interface RejectedCarrierEnvelope {
  carrierMessageId: string;
  code: CarrierDecodeFailureCode | "unsupported_content_type";
  detail: string;
  senderInboxId: string;
  status: "rejected";
}

export interface DuplicateCarrierEnvelope {
  carrierMessageId: string;
  status: "duplicate";
}

export type InspectedCarrierEnvelope =
  AcceptedCarrierEnvelope | DuplicateCarrierEnvelope | RejectedCarrierEnvelope;

export interface InspectMessagesOptions {
  seenCarrierMessageIds?: ReadonlySet<string>;
}

export interface XmtpRetryOptions {
  attempts?: number;
  delayMs?: number;
  sleep?: (durationMs: number) => Promise<void>;
}

export class XmtpRetryExhaustedError extends Error {
  readonly attempts: number;

  constructor(attempts: number, cause: unknown) {
    super(`XMTP sync remained unavailable after ${String(attempts)} attempts.`, { cause });
    this.name = "XmtpRetryExhaustedError";
    this.attempts = attempts;
  }
}

export function isRetryableXmtpError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:429|rate.?limit|resource has been exhausted|temporarily unavailable|unavailable|deadline exceeded|try again)/iu.test(
    message,
  );
}

export async function withXmtpRetry<T>(
  operation: () => Promise<T>,
  options: XmtpRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 4;
  const delayMs = options.delayMs ?? 2_000;
  const sleep =
    options.sleep ??
    ((durationMs) => new Promise<void>((resolve) => setTimeout(resolve, durationMs)));
  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new RangeError("XMTP retry attempts must be a positive integer.");
  }
  if (!Number.isSafeInteger(delayMs) || delayMs < 0) {
    throw new RangeError("XMTP retry delay must be a non-negative integer.");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableXmtpError(error) || attempt === attempts) break;
      await sleep(delayMs * 2 ** (attempt - 1));
    }
  }

  if (isRetryableXmtpError(lastError)) {
    throw new XmtpRetryExhaustedError(attempts, lastError);
  }
  throw lastError;
}

function toTextMessage(message: DecodedMessage): CarrierTextMessage | null {
  if (!isText(message) || typeof message.content !== "string") return null;
  return {
    content: message.content,
    id: message.id,
    senderInboxId: message.senderInboxId,
  };
}

export class NodeXmtpCarrier {
  readonly #backend: Backend;
  readonly #client: Client;

  private constructor(backend: Backend, client: Client) {
    this.#backend = backend;
    this.#client = client;
  }

  static async connect(config: MeterMeshXmtpConfig): Promise<NodeXmtpCarrier> {
    await mkdir(dirname(config.dbPath), { mode: 0o700, recursive: true });
    await chmod(dirname(config.dbPath), 0o700);
    const identity = createMeterMeshIdentity(config.walletKey);
    const backend = await createBackend({
      appVersion: config.appVersion,
      env: config.env,
    });
    const client = await Client.create(identity.xmtpSigner, {
      backend,
      dbEncryptionKey: config.dbEncryptionKey,
      dbPath: config.dbPath,
      disableDeviceSync: true,
      useSingleConnection: true,
    });
    await secureXmtpDatabasePath(config.dbPath);
    return new NodeXmtpCarrier(backend, client);
  }

  get inboxId(): string {
    return this.#client.inboxId;
  }

  async close(): Promise<void> {
    await this.#client.close();
  }

  async sendEnvelope(
    recipientInboxId: string,
    envelope: Envelope,
    result?: TransactionExplanation,
  ): Promise<string> {
    if (envelope.senderInboxId.toLowerCase() !== this.inboxId.toLowerCase()) {
      throw new Error("Outgoing envelope sender does not match this XMTP client inbox.");
    }
    if (
      !(await Client.isAddressAuthorized(this.inboxId, envelope.signature.signer, this.#backend))
    ) {
      throw new Error("Outgoing envelope signer is not authorized for this XMTP inbox.");
    }
    const conversation = await this.#client.conversations.createDm(recipientInboxId);
    return conversation.sendText(encodeCarrierEnvelope(envelope, result), {
      idempotencyKey: envelope.messageId,
    });
  }

  async syncMessages(): Promise<DecodedMessage[]> {
    return withXmtpRetry(async () => {
      await this.#client.conversations.syncAll(consentStates);
      const conversations = this.#client.conversations.listDms({
        consentStates,
      });
      const nestedMessages = await Promise.all(
        conversations.map(async (conversation) => {
          await conversation.sync();
          return conversation.messages();
        }),
      );
      return nestedMessages
        .flat()
        .sort((left, right) =>
          left.sentAtNs < right.sentAtNs ? -1 : left.sentAtNs > right.sentAtNs ? 1 : 0,
        );
    });
  }

  async inspectMessages(
    messages: readonly DecodedMessage[],
    options: InspectMessagesOptions = {},
  ): Promise<InspectedCarrierEnvelope[]> {
    const seen = new Set(options.seenCarrierMessageIds);
    return Promise.all(
      messages.map(async (message): Promise<InspectedCarrierEnvelope> => {
        if (seen.has(message.id)) {
          return { carrierMessageId: message.id, status: "duplicate" };
        }
        seen.add(message.id);
        const textMessage = toTextMessage(message);
        if (textMessage === null) {
          return {
            carrierMessageId: message.id,
            code: "unsupported_content_type",
            detail: "XMTP message is not plain text MeterMesh content.",
            senderInboxId: message.senderInboxId,
            status: "rejected",
          };
        }
        const [decoded] = await inspectCarrierTextMessages([textMessage], {
          isSignerAuthorized: (inboxId, address) =>
            Client.isAddressAuthorized(inboxId, address, this.#backend),
        });
        if (decoded === undefined) throw new Error("Carrier inspection returned no result.");
        if (decoded.status === "rejected") {
          return {
            carrierMessageId: message.id,
            code: decoded.code,
            detail: decoded.detail,
            senderInboxId: message.senderInboxId,
            status: "rejected",
          };
        }
        if (decoded.status === "duplicate") return decoded;
        return {
          carrierMessageId: message.id,
          envelope: decoded.envelope,
          result: decoded.result,
          sentAt: message.sentAt,
          sentAtNs: message.sentAtNs,
          status: "accepted",
        };
      }),
    );
  }

  async streamMessages(): Promise<AsyncStreamProxy<DecodedMessage>> {
    return this.#client.conversations.streamAllDmMessages({
      consentStates,
      retryAttempts: 5,
      retryDelay: 2_000,
      retryOnFail: true,
    });
  }
}
