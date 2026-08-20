import type { JsonObject, OutboxJob } from "../../../../packages/db/src/index";
import type { WorkerOutboxStore } from "../../../worker/src/orchestrator";

function createJob(input: {
  id: bigint;
  jobKey: string;
  jobType: string;
  payload: JsonObject;
}): OutboxJob {
  return {
    attempts: 0n,
    availableAt: new Date(),
    createdAt: new Date(),
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

export class LiveMemoryOutbox implements WorkerOutboxStore {
  readonly #jobs = new Map<string, OutboxJob>();
  readonly #rejections = new Set<string>();
  #nextId = 1n;

  claimOutbox(input: {
    jobTypes?: string[];
    leaseSeconds: number;
    limit: number;
    workerId: string;
  }): Promise<OutboxJob[]> {
    const now = Date.now();
    const jobs = [...this.#jobs.values()]
      .filter(
        (job) =>
          job.processedAt === null &&
          job.workerId === null &&
          job.availableAt.getTime() <= now &&
          (input.jobTypes?.includes(job.jobType) ?? true),
      )
      .slice(0, input.limit);
    for (const job of jobs) {
      job.attempts += 1n;
      job.workerId = input.workerId;
      job.leaseExpiresAt = new Date(now + input.leaseSeconds * 1_000);
    }
    return Promise.resolve(jobs);
  }

  completeOutbox(jobId: bigint, workerId: string): Promise<boolean> {
    const job = [...this.#jobs.values()].find((candidate) => candidate.id === jobId);
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
    const existing = this.#jobs.get(input.jobKey);
    if (existing !== undefined) {
      if (
        existing.jobType !== input.jobType ||
        JSON.stringify(existing.payload) !== JSON.stringify(input.payload)
      ) {
        return Promise.reject(new Error("Live outbox collision has different content."));
      }
      return Promise.resolve(existing);
    }
    const job = createJob({ ...input, id: this.#nextId });
    this.#nextId += 1n;
    this.#jobs.set(job.jobKey, job);
    return Promise.resolve(job);
  }

  failOutbox(input: {
    availableAt: Date;
    error: string;
    jobId: bigint;
    workerId: string;
  }): Promise<boolean> {
    const job = [...this.#jobs.values()].find((candidate) => candidate.id === input.jobId);
    if (job?.workerId !== input.workerId) return Promise.resolve(false);
    job.availableAt = input.availableAt;
    job.lastError = input.error;
    job.workerId = null;
    job.leaseExpiresAt = null;
    return Promise.resolve(true);
  }

  getOutboxByJobKey(jobKey: string): Promise<OutboxJob | null> {
    return Promise.resolve(this.#jobs.get(jobKey) ?? null);
  }

  recordEnvelopeRejection(input: {
    carrierMessageId: string;
    rawEnvelope: JsonObject;
    reason: string;
  }): Promise<boolean> {
    const key = `${input.carrierMessageId}:${input.reason}`;
    if (this.#rejections.has(key)) return Promise.resolve(false);
    this.#rejections.add(key);
    return Promise.resolve(true);
  }
}
