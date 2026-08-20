import type { TransactionExplanation } from "@metermesh/ai";
import type { JsonObject, OutboxJob } from "@metermesh/db";
import { signEnvelope, type Envelope } from "@metermesh/protocol";
import { createMeterMeshIdentity, type InspectedCarrierEnvelope } from "@metermesh/xmtp";
import { getAddress, type Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EXPLAIN_REQUEST_JOB,
  MeterMeshTransportWorker,
  SEND_DELIVERY_JOB,
  type WorkerCarrier,
  type WorkerOutboxStore,
} from "./orchestrator.js";

const buyerKey: Hex = `0x${"11".repeat(32)}`;
const sellerKey: Hex = `0x${"22".repeat(32)}`;
const buyerIdentity = createMeterMeshIdentity(buyerKey);
const sellerIdentity = createMeterMeshIdentity(sellerKey);
const buyerInboxId = "buyer-live-inbox";
const sellerInboxId = "seller-live-inbox";
const transactionHash = `0x${"33".repeat(32)}` as const;

const explanation: TransactionExplanation = {
  call: {
    createdContract: null,
    from: `0x${"11".repeat(20)}`,
    inputByteLength: 0,
    inputSelector: null,
    to: `0x${"22".repeat(20)}`,
  },
  chainId: 1952,
  chainName: "X Layer Testnet",
  emittedLogs: [],
  failureReason: null,
  financials: {
    executionFeeOkb: "0",
    executionFeeWei: "0",
    valueOkb: "0",
    valueWei: "0",
  },
  generation: {
    aiAuthoredFields: ["summary", "outcome", "limitations"],
    model: "openai/gpt-oss-20b",
    provider: "groq",
    responseId: "worker-test",
  },
  limitations: ["This is a worker orchestration fixture."],
  outcome: "The transaction reference remained bound to the delivery.",
  provenance: {
    blockHash: `0x${"44".repeat(32)}`,
    blockNumber: "100",
    confirmations: "2",
    factsFetchedAt: "2026-08-20T12:00:00.000Z",
    source: "x-layer-rpc",
  },
  schemaVersion: "1",
  status: "success",
  summary: "The worker returned one schema-valid X Layer explanation.",
  transactionHash,
};

function outboxJob(input: {
  id: bigint;
  jobKey: string;
  jobType: string;
  payload: JsonObject;
}): OutboxJob {
  return {
    attempts: 0n,
    availableAt: new Date("2026-08-20T12:00:00.000Z"),
    createdAt: new Date("2026-08-20T12:00:00.000Z"),
    id: input.id,
    jobKey: input.jobKey,
    jobType: input.jobType,
    lastError: null,
    leaseExpiresAt: null,
    payload: input.payload,
    processedAt: null,
    sessionId: null,
    workerId: null,
  };
}

class MemoryOutbox implements WorkerOutboxStore {
  readonly jobs = new Map<string, OutboxJob>();
  readonly rejections: string[] = [];
  failCompletionOnce = false;
  #nextId = 1n;

  claimOutbox(input: {
    jobTypes?: string[];
    leaseSeconds: number;
    limit: number;
    workerId: string;
  }): Promise<OutboxJob[]> {
    const claimed = [...this.jobs.values()]
      .filter(
        (job) =>
          job.processedAt === null &&
          job.workerId === null &&
          (input.jobTypes?.includes(job.jobType) ?? true),
      )
      .slice(0, input.limit);
    for (const job of claimed) {
      job.attempts += 1n;
      job.workerId = input.workerId;
      job.leaseExpiresAt = new Date(Date.now() + input.leaseSeconds * 1_000);
    }
    return Promise.resolve(claimed);
  }

  completeOutbox(jobId: bigint, workerId: string): Promise<boolean> {
    if (this.failCompletionOnce) {
      this.failCompletionOnce = false;
      return Promise.resolve(false);
    }
    const job = [...this.jobs.values()].find((candidate) => candidate.id === jobId);
    if (job?.workerId !== workerId) return Promise.resolve(false);
    job.processedAt = new Date();
    job.workerId = null;
    job.leaseExpiresAt = null;
    return Promise.resolve(true);
  }

  enqueueOutbox(input: {
    jobKey: string;
    jobType: string;
    payload: JsonObject;
  }): Promise<OutboxJob> {
    const existing = this.jobs.get(input.jobKey);
    if (existing !== undefined) {
      if (
        existing.jobType !== input.jobType ||
        JSON.stringify(existing.payload) !== JSON.stringify(input.payload)
      ) {
        throw new Error("Outbox collision has different content.");
      }
      return Promise.resolve(existing);
    }
    const job = outboxJob({ ...input, id: this.#nextId });
    this.#nextId += 1n;
    this.jobs.set(input.jobKey, job);
    return Promise.resolve(job);
  }

  failOutbox(input: {
    availableAt: Date;
    error: string;
    jobId: bigint;
    workerId: string;
  }): Promise<boolean> {
    const job = [...this.jobs.values()].find((candidate) => candidate.id === input.jobId);
    if (job?.workerId !== input.workerId) return Promise.resolve(false);
    job.availableAt = input.availableAt;
    job.lastError = input.error;
    job.workerId = null;
    job.leaseExpiresAt = null;
    return Promise.resolve(true);
  }

  getOutboxByJobKey(jobKey: string): Promise<OutboxJob | null> {
    return Promise.resolve(this.jobs.get(jobKey) ?? null);
  }

  recordEnvelopeRejection(input: {
    carrierMessageId: string;
    rawEnvelope: JsonObject;
    reason: string;
  }): Promise<boolean> {
    this.rejections.push(`${input.carrierMessageId}:${input.reason}`);
    return Promise.resolve(true);
  }
}

async function requestEnvelope(
  signer = buyerIdentity.envelopeSigner,
): Promise<Extract<Envelope, { type: "work.request" }>> {
  const envelope = await signEnvelope(
    {
      createdAt: "2026-08-20T12:00:00.000Z",
      messageId: "request-worker-001",
      payload: { transactionHash, workUnitId: "work-worker-001" },
      protocol: "metermesh",
      senderInboxId: buyerInboxId,
      sequence: 1,
      sessionId: "transport-worker-001",
      type: "work.request",
      version: 1,
    },
    signer,
  );
  if (envelope.type !== "work.request") throw new Error("Expected request envelope.");
  return envelope;
}

function acceptedRequest(envelope: Envelope): InspectedCarrierEnvelope {
  return {
    carrierMessageId: "carrier-request-001",
    envelope,
    result: null,
    sentAt: new Date("2026-08-20T12:00:00.000Z"),
    sentAtNs: 1n,
    status: "accepted",
  };
}

describe("MeterMesh transport worker", () => {
  let inspected: InspectedCarrierEnvelope[];
  let outbox: MemoryOutbox;
  let sendEnvelope: ReturnType<typeof vi.fn<WorkerCarrier["sendEnvelope"]>>;
  let explain: ReturnType<typeof vi.fn<(hash: string) => Promise<TransactionExplanation>>>;
  let carrier: WorkerCarrier;

  beforeEach(() => {
    inspected = [];
    outbox = new MemoryOutbox();
    sendEnvelope = vi.fn(() => Promise.resolve("carrier-delivery-001"));
    explain = vi.fn(() => Promise.resolve(explanation));
    carrier = {
      inboxId: sellerInboxId,
      inspectMessages: () => Promise.resolve(inspected),
      sendEnvelope,
      syncMessages: () => Promise.resolve([]),
    };
  });

  function worker(): MeterMeshTransportWorker {
    return new MeterMeshTransportWorker({
      allowedBuyerAddress: getAddress(buyerIdentity.envelopeSigner.address),
      carrier,
      explain,
      now: () => new Date("2026-08-20T12:00:05.000Z"),
      outbox,
      sellerWalletKey: sellerKey,
      workerId: "worker-test",
    });
  }

  it("queues an allowlisted request once and rejects a different signer", async () => {
    const request = await requestEnvelope();
    inspected = [acceptedRequest(request), acceptedRequest(request)];

    await expect(worker().ingest()).resolves.toEqual({ queued: 2, rejected: 0 });
    expect(outbox.jobs).toHaveLength(1);

    const outsider = await requestEnvelope(sellerIdentity.envelopeSigner);
    inspected = [acceptedRequest(outsider)];
    await expect(worker().ingest()).resolves.toEqual({ queued: 0, rejected: 1 });
    expect(outbox.rejections).toHaveLength(1);
  });

  it("persists the result before sending one hash-bound delivery", async () => {
    const request = await requestEnvelope();
    inspected = [acceptedRequest(request)];
    const instance = worker();
    await instance.ingest();

    await expect(instance.processAvailable()).resolves.toEqual({ completed: 1, failed: 0 });
    expect(explain).toHaveBeenCalledOnce();
    expect(outbox.jobs.get(`xmtp.delivery:${request.messageId}`)?.jobType).toBe(SEND_DELIVERY_JOB);

    await expect(instance.processAvailable()).resolves.toEqual({ completed: 1, failed: 0 });
    expect(sendEnvelope).toHaveBeenCalledOnce();
    const [, delivery, result] = sendEnvelope.mock.calls[0] ?? [];
    expect(delivery?.type).toBe("work.delivery");
    expect(delivery?.payload).toMatchObject({
      requestMessageId: request.messageId,
      transactionHash,
      workUnitId: request.payload.workUnitId,
    });
    expect(result).toEqual(explanation);
  });

  it("reuses a persisted delivery after a request completion interruption", async () => {
    const request = await requestEnvelope();
    inspected = [acceptedRequest(request)];
    const instance = worker();
    await instance.ingest();
    outbox.failCompletionOnce = true;

    await expect(instance.processAvailable()).resolves.toEqual({ completed: 0, failed: 1 });
    await expect(instance.processAvailable()).resolves.toEqual({ completed: 2, failed: 0 });
    expect(explain).toHaveBeenCalledOnce();
    expect(sendEnvelope).toHaveBeenCalledOnce();
  });

  it("keeps explainer failures nonbillable and retryable", async () => {
    const request = await requestEnvelope();
    inspected = [acceptedRequest(request)];
    explain.mockRejectedValueOnce(new Error("RPC unavailable"));
    const instance = worker();
    await instance.ingest();

    await expect(instance.processAvailable()).resolves.toEqual({ completed: 0, failed: 1 });
    const requestJob = outbox.jobs.get(`xmtp.request:${request.messageId}`);
    expect(requestJob).toMatchObject({ lastError: "RPC unavailable", processedAt: null });
    expect(sendEnvelope).not.toHaveBeenCalled();
  });

  it("never lets a mismatched explanation reach delivery", async () => {
    const request = await requestEnvelope();
    inspected = [acceptedRequest(request)];
    explain.mockResolvedValueOnce({
      ...explanation,
      transactionHash: `0x${"55".repeat(32)}`,
    });
    const instance = worker();
    await instance.ingest();

    await expect(instance.processAvailable()).resolves.toEqual({ completed: 0, failed: 1 });
    expect([...outbox.jobs.values()].some((job) => job.jobType === SEND_DELIVERY_JOB)).toBe(false);
  });

  it("claims only the two transport job types", async () => {
    const claim = vi.spyOn(outbox, "claimOutbox");
    await worker().processAvailable();
    expect(claim).toHaveBeenCalledWith(
      expect.objectContaining({ jobTypes: [EXPLAIN_REQUEST_JOB, SEND_DELIVERY_JOB] }),
    );
  });
});
