import { transactionExplanationSchema, type TransactionExplanation } from "@metermesh/ai";
import type { JsonObject, OutboxJob } from "@metermesh/db";
import {
  hashCanonical,
  signEnvelope,
  validateEnvelope,
  type CanonicalValue,
  type Envelope,
} from "@metermesh/protocol";
import type { InspectedCarrierEnvelope, NodeXmtpCarrier } from "@metermesh/xmtp";
import { z } from "zod";

import { createMeterMeshIdentity } from "@metermesh/xmtp";
import type { Hex } from "viem";

export const EXPLAIN_REQUEST_JOB = "xmtp.explain-request";
export const SEND_DELIVERY_JOB = "xmtp.send-delivery";

const requestJobSchema = z.strictObject({ envelope: z.unknown() });
const deliveryJobSchema = z.strictObject({
  envelope: z.unknown(),
  recipientInboxId: z.string().min(1),
  result: transactionExplanationSchema.nullable(),
});

type WorkRequestEnvelope = Extract<Envelope, { type: "work.request" }>;
type WorkErrorCode = Extract<Envelope, { type: "work.error" }>["payload"]["code"];

export type WorkerRequestAuthorization =
  | { ok: true }
  | { detail: string; ok: false; silent: true }
  | {
      code: WorkErrorCode;
      detail: string;
      ok: false;
      retryable: boolean;
      silent: false;
    };

export type WorkerRequestAuthorizer = (
  request: WorkRequestEnvelope,
  context: { carrierMessageId: string; sentAt: Date },
) => Promise<WorkerRequestAuthorization>;

export interface WorkerOutboxStore {
  claimOutbox(input: {
    jobTypes?: string[];
    leaseSeconds: number;
    limit: number;
    workerId: string;
  }): Promise<OutboxJob[]>;
  completeOutbox(jobId: bigint, workerId: string): Promise<boolean>;
  enqueueOutbox(input: {
    jobKey: string;
    jobType: string;
    payload: JsonObject;
  }): Promise<OutboxJob>;
  failOutbox(input: {
    availableAt: Date;
    error: string;
    jobId: bigint;
    workerId: string;
  }): Promise<boolean>;
  getOutboxByJobKey(jobKey: string): Promise<OutboxJob | null>;
  recordEnvelopeRejection(input: {
    carrierMessageId: string;
    rawEnvelope: JsonObject;
    reason: string;
  }): Promise<boolean>;
}

export interface WorkerCarrier {
  inboxId: string;
  inspectMessages(
    messages: Awaited<ReturnType<NodeXmtpCarrier["syncMessages"]>>,
  ): Promise<InspectedCarrierEnvelope[]>;
  sendEnvelope(
    recipientInboxId: string,
    envelope: Envelope,
    result?: TransactionExplanation,
  ): Promise<string>;
  syncMessages(): ReturnType<NodeXmtpCarrier["syncMessages"]>;
}

export interface MeterMeshTransportWorkerOptions {
  authorizeRequest: WorkerRequestAuthorizer;
  carrier: WorkerCarrier;
  explain: (transactionHash: string) => Promise<TransactionExplanation>;
  now?: () => Date;
  outbox: WorkerOutboxStore;
  sellerWalletKey: Hex;
  workerId: string;
}

function asCanonical(value: unknown): CanonicalValue {
  return value as CanonicalValue;
}

function asJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown worker failure.";
}

async function requireRequestEnvelope(
  input: unknown,
): Promise<Extract<Envelope, { type: "work.request" }>> {
  const validation = await validateEnvelope(input);
  if (!validation.ok || validation.envelope.type !== "work.request") {
    throw new TypeError("Outbox request payload does not contain a valid work.request envelope.");
  }
  return validation.envelope;
}

async function requireResponseEnvelope(
  input: unknown,
): Promise<Extract<Envelope, { type: "work.delivery" | "work.error" }>> {
  const validation = await validateEnvelope(input);
  if (
    !validation.ok ||
    (validation.envelope.type !== "work.delivery" && validation.envelope.type !== "work.error")
  ) {
    throw new TypeError(
      "Outbox response payload does not contain a valid delivery or error envelope.",
    );
  }
  return validation.envelope;
}

function deliveryJobKey(requestMessageId: string): string {
  return `xmtp.delivery:${requestMessageId}`;
}

export class MeterMeshTransportWorker {
  readonly #authorizeRequest: WorkerRequestAuthorizer;
  readonly #carrier: WorkerCarrier;
  readonly #explain: MeterMeshTransportWorkerOptions["explain"];
  readonly #now: () => Date;
  readonly #outbox: WorkerOutboxStore;
  readonly #sellerWalletKey: Hex;
  readonly #workerId: string;

  constructor(options: MeterMeshTransportWorkerOptions) {
    this.#authorizeRequest = options.authorizeRequest;
    this.#carrier = options.carrier;
    this.#explain = options.explain;
    this.#now = options.now ?? (() => new Date());
    this.#outbox = options.outbox;
    this.#sellerWalletKey = options.sellerWalletKey;
    this.#workerId = options.workerId;
  }

  async ingest(): Promise<{ queued: number; rejected: number }> {
    const inspected = await this.#carrier.inspectMessages(await this.#carrier.syncMessages());
    let queued = 0;
    let rejected = 0;
    for (const item of inspected) {
      if (item.status === "duplicate") continue;
      if (item.status === "rejected") {
        await this.#outbox.recordEnvelopeRejection({
          carrierMessageId: item.carrierMessageId,
          rawEnvelope: {
            code: item.code,
            senderInboxId: item.senderInboxId,
          },
          reason: item.detail,
        });
        rejected += 1;
        continue;
      }
      const { envelope } = item;
      if (envelope.type !== "work.request") continue;
      const authorization: WorkerRequestAuthorization =
        envelope.sequence === 1
          ? await this.#authorizeRequest(envelope, {
              carrierMessageId: item.carrierMessageId,
              sentAt: item.sentAt,
            })
          : {
              code: "invalid_sequence",
              detail: "The verification request must use sequence 1 in a fresh session.",
              ok: false,
              retryable: false,
              silent: false,
            };
      if (!authorization.ok) {
        if (authorization.silent) continue;
        await this.#outbox.recordEnvelopeRejection({
          carrierMessageId: item.carrierMessageId,
          rawEnvelope: asJsonObject(envelope),
          reason: authorization.detail,
        });
        await this.#queueError(envelope, authorization);
        rejected += 1;
        continue;
      }
      await this.#outbox.enqueueOutbox({
        jobKey: `xmtp.request:${envelope.messageId}`,
        jobType: EXPLAIN_REQUEST_JOB,
        payload: { envelope: asJsonObject(envelope) },
      });
      queued += 1;
    }
    return { queued, rejected };
  }

  async processAvailable(limit = 10): Promise<{ completed: number; failed: number }> {
    const jobs = await this.#outbox.claimOutbox({
      jobTypes: [EXPLAIN_REQUEST_JOB, SEND_DELIVERY_JOB],
      leaseSeconds: 60,
      limit,
      workerId: this.#workerId,
    });
    let completed = 0;
    let failed = 0;
    for (const job of jobs) {
      try {
        if (job.jobType === EXPLAIN_REQUEST_JOB) await this.#prepareDelivery(job);
        else await this.#sendDelivery(job);
        if (!(await this.#outbox.completeOutbox(job.id, this.#workerId))) {
          throw new Error("Worker lost its outbox lease before completion.");
        }
        completed += 1;
      } catch (error) {
        await this.#outbox.failOutbox({
          availableAt: new Date(
            this.#now().getTime() + Math.min(60_000, 2 ** Number(job.attempts) * 1_000),
          ),
          error: safeError(error),
          jobId: job.id,
          workerId: this.#workerId,
        });
        failed += 1;
      }
    }
    return { completed, failed };
  }

  async #prepareDelivery(job: OutboxJob): Promise<void> {
    const parsed = requestJobSchema.parse(job.payload);
    const request = await requireRequestEnvelope(parsed.envelope);
    const key = deliveryJobKey(request.messageId);
    if ((await this.#outbox.getOutboxByJobKey(key)) !== null) return;

    const explanation = transactionExplanationSchema.parse(
      await this.#explain(request.payload.transactionHash),
    );
    if (explanation.transactionHash !== request.payload.transactionHash) {
      throw new TypeError("Explainer returned a different transaction hash.");
    }
    const signed = await signEnvelope(
      {
        createdAt: this.#now().toISOString(),
        messageId: `delivery-${request.messageId}`,
        payload: {
          deliverySchema: "metermesh.transaction-explanation.v1",
          requestMessageId: request.messageId,
          resultHash: hashCanonical(asCanonical(explanation)),
          transactionHash: request.payload.transactionHash,
          workUnitId: request.payload.workUnitId,
        },
        protocol: "metermesh",
        senderInboxId: this.#carrier.inboxId,
        sequence: 1,
        sessionId: request.sessionId,
        type: "work.delivery",
        version: 1,
      },
      createMeterMeshIdentity(this.#sellerWalletKey).envelopeSigner,
    );
    if (signed.type !== "work.delivery")
      throw new TypeError("Worker created a wrong envelope type.");
    await this.#outbox.enqueueOutbox({
      jobKey: key,
      jobType: SEND_DELIVERY_JOB,
      payload: {
        envelope: asJsonObject(signed),
        recipientInboxId: request.senderInboxId,
        result: asJsonObject(explanation),
      },
    });
  }

  async #queueError(
    request: WorkRequestEnvelope,
    denial: Extract<WorkerRequestAuthorization, { ok: false; silent: false }>,
  ): Promise<void> {
    const key = `xmtp.error:${request.messageId}`;
    if ((await this.#outbox.getOutboxByJobKey(key)) !== null) return;
    const signed = await signEnvelope(
      {
        createdAt: this.#now().toISOString(),
        messageId: `error-${request.messageId}`,
        payload: {
          code: denial.code,
          detail: denial.detail,
          requestMessageId: request.messageId,
          retryable: denial.retryable,
          transactionHash: request.payload.transactionHash,
          workUnitId: request.payload.workUnitId,
        },
        protocol: "metermesh",
        senderInboxId: this.#carrier.inboxId,
        sequence: 1,
        sessionId: request.sessionId,
        type: "work.error",
        version: 1,
      },
      createMeterMeshIdentity(this.#sellerWalletKey).envelopeSigner,
    );
    await this.#outbox.enqueueOutbox({
      jobKey: key,
      jobType: SEND_DELIVERY_JOB,
      payload: {
        envelope: asJsonObject(signed),
        recipientInboxId: request.senderInboxId,
        result: null,
      },
    });
  }

  async #sendDelivery(job: OutboxJob): Promise<void> {
    const parsed = deliveryJobSchema.parse(job.payload);
    const envelope = await requireResponseEnvelope(parsed.envelope);
    await this.#carrier.sendEnvelope(parsed.recipientInboxId, envelope, parsed.result ?? undefined);
  }
}
