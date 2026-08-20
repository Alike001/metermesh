import {
  createSessionState,
  hashCanonical,
  signEnvelope,
  type Envelope,
  type SessionState,
} from "@metermesh/protocol";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import postgres, { type Sql } from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseInvariantError, StaleSessionVersionError } from "./errors.js";
import { MeterMeshDatabase } from "./meter-mesh-database.js";

const escrowAddress = getAddress("0x5E550002e64FaF79B41D89fE8439eEb1be66CE3b");
const tokenAddress = getAddress("0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c");
const createdAt = "2026-08-19T12:00:00.000Z";

let container: StartedPostgreSqlContainer;
let database: MeterMeshDatabase;
let admin: Sql;
let started = false;
let connectionUri: string;
let buyer: PrivateKeyAccount;
let seller: PrivateKeyAccount;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  connectionUri = container.getConnectionUri();
  database = MeterMeshDatabase.connect(connectionUri, { maxConnections: 8 });
  admin = postgres(connectionUri, { max: 4 });
  await database.migrate();
  started = true;
}, 120_000);

beforeEach(() => {
  buyer = privateKeyToAccount(generatePrivateKey());
  seller = privateKeyToAccount(generatePrivateKey());
});

afterEach(async () => {
  if (!started) return;
  await admin.unsafe(`
    truncate table
      outbox,
      chain_operations,
      vouchers,
      work_units,
      envelope_rejections,
      envelopes,
      mpp_session_state,
      sessions
    restart identity cascade
  `);
});

afterAll(async () => {
  if (!started) return;
  await Promise.allSettled([
    database.close(),
    admin.end({ timeout: 5 }),
    container.stop({ timeout: 10_000 }),
  ]);
});

function state(sessionId = "session-001", cap = "15"): SessionState {
  return createSessionState({
    buyer: { address: buyer.address, inboxId: "buyer-inbox" },
    cap,
    chainId: 1952,
    channelId: hashCanonical(`channel-${sessionId}`),
    escrowAddress,
    seller: { address: seller.address, inboxId: "seller-inbox" },
    sessionId,
    tokenAddress,
    unitPrice: "5",
  });
}

function header(actor: "buyer" | "seller", messageId: string, sequence: number, sessionId: string) {
  return {
    createdAt,
    messageId,
    protocol: "metermesh" as const,
    senderInboxId: actor === "buyer" ? "buyer-inbox" : "seller-inbox",
    sequence,
    sessionId,
    version: 1 as const,
  };
}

async function request(
  sessionId: string,
  workUnitId: string,
  sequence: number,
  messageId = `request-${workUnitId}`,
): Promise<Extract<Envelope, { type: "work.request" }>> {
  return (await signEnvelope(
    {
      ...header("buyer", messageId, sequence, sessionId),
      payload: { transactionHash: hashCanonical(`tx-${workUnitId}`), workUnitId },
      type: "work.request",
    },
    buyer,
  )) as Extract<Envelope, { type: "work.request" }>;
}

async function delivery(
  sessionId: string,
  requestEnvelope: Extract<Envelope, { type: "work.request" }>,
  sequence: number,
): Promise<Extract<Envelope, { type: "work.delivery" }>> {
  return (await signEnvelope(
    {
      ...header("seller", `delivery-${requestEnvelope.payload.workUnitId}`, sequence, sessionId),
      payload: {
        deliverySchema: "metermesh.transaction-explanation.v1",
        requestMessageId: requestEnvelope.messageId,
        resultHash: hashCanonical(`result-${requestEnvelope.payload.workUnitId}`),
        transactionHash: requestEnvelope.payload.transactionHash,
        workUnitId: requestEnvelope.payload.workUnitId,
      },
      type: "work.delivery",
    },
    seller,
  )) as Extract<Envelope, { type: "work.delivery" }>;
}

async function acceptance(
  sessionId: string,
  deliveryEnvelope: Extract<Envelope, { type: "work.delivery" }>,
  sequence: number,
  cumulativeAmount: string,
): Promise<Extract<Envelope, { type: "work.accept" }>> {
  return (await signEnvelope(
    {
      ...header("buyer", `accept-${deliveryEnvelope.payload.workUnitId}`, sequence, sessionId),
      payload: {
        cumulativeAmount,
        deliveryMessageId: deliveryEnvelope.messageId,
        deliveryPayloadHash: deliveryEnvelope.payloadHash,
        voucherCredentialHash: hashCanonical(`voucher-${deliveryEnvelope.payload.workUnitId}`),
        workUnitId: deliveryEnvelope.payload.workUnitId,
      },
      type: "work.accept",
    },
    buyer,
  )) as Extract<Envelope, { type: "work.accept" }>;
}

describe("MeterMeshDatabase", () => {
  it("runs migrations idempotently and creates the expected durable tables", async () => {
    await database.migrate();
    const rows = await admin<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `;

    expect(rows.map(({ table_name }) => table_name)).toEqual(
      expect.arrayContaining([
        "chain_operations",
        "envelopes",
        "mpp_session_state",
        "outbox",
        "sessions",
        "vouchers",
        "work_units",
      ]),
    );
  });

  it("reads a session through a restarted database client", async () => {
    const initial = state();
    await database.createSession(initial);

    const restarted = MeterMeshDatabase.connect(connectionUri, { maxConnections: 2 });
    const loaded = await restarted.getSession(initial.config.sessionId);
    await restarted.close();

    expect(loaded).toEqual({ state: initial, version: 0n });
  });

  it("rolls back failed mutations and serializes stale concurrent writers", async () => {
    const initial = state();
    await database.createSession(initial);

    await expect(
      database.updateSession(initial.config.sessionId, 0n, () => {
        throw new Error("abort mutation");
      }),
    ).rejects.toThrow("abort mutation");
    await expect(database.getSession(initial.config.sessionId)).resolves.toEqual({
      state: initial,
      version: 0n,
    });
    await expect(
      database.updateSession(initial.config.sessionId, 0n, (current) => ({
        ...current,
        config: { ...current.config, cap: "20" },
      })),
    ).rejects.toThrow("configuration is immutable");

    const writes = await Promise.allSettled([
      database.updateSession(initial.config.sessionId, 0n, (current) => current),
      database.updateSession(initial.config.sessionId, 0n, (current) => current),
    ]);
    expect(writes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = writes.find(({ status }) => status === "rejected");
    expect(rejected?.status).toBe("rejected");
    if (rejected?.status !== "rejected") throw new Error("Expected one rejected writer.");
    expect(rejected.reason).toBeInstanceOf(StaleSessionVersionError);
    await expect(database.getSession(initial.config.sessionId)).resolves.toMatchObject({
      version: 1n,
    });
  });

  it("atomically stores accepted envelopes and makes duplicate delivery a no-op", async () => {
    const initial = state();
    await database.createSession(initial);
    const envelope = await request(initial.config.sessionId, "unit-001", 1);

    const first = await database.processEnvelope({
      direction: "inbound",
      envelope,
      sessionId: initial.config.sessionId,
    });
    const replay = await database.processEnvelope({
      direction: "inbound",
      envelope,
      sessionId: initial.config.sessionId,
    });

    expect(first).toMatchObject({ duplicate: false, status: "accepted" });
    expect(replay).toMatchObject({ duplicate: true, event: null, status: "accepted" });
    expect(replay.snapshot.version).toBe(1n);

    const [counts] = await admin<
      { envelope_count: string; outbox_count: string; work_count: string }[]
    >`
      select
        (select count(*) from envelopes) as envelope_count,
        (select count(*) from work_units) as work_count,
        (select count(*) from outbox) as outbox_count
    `;
    expect(counts).toEqual({ envelope_count: "1", outbox_count: "1", work_count: "1" });
  });

  it("stores out-of-order rejection without blocking a later valid sequence", async () => {
    const initial = state();
    await database.createSession(initial);
    const early = await request(initial.config.sessionId, "unit-early", 2, "early-message");
    const rejected = await database.processEnvelope({
      direction: "inbound",
      envelope: early,
      sessionId: initial.config.sessionId,
    });
    expect(rejected).toMatchObject({ code: "out_of_order", status: "rejected" });

    const first = await request(initial.config.sessionId, "unit-001", 1);
    await expect(
      database.processEnvelope({
        direction: "inbound",
        envelope: first,
        sessionId: initial.config.sessionId,
      }),
    ).resolves.toMatchObject({ status: "accepted" });

    const replacement = await request(
      initial.config.sessionId,
      "unit-002",
      2,
      "replacement-message",
    );
    await expect(
      database.processEnvelope({
        direction: "inbound",
        envelope: replacement,
        sessionId: initial.config.sessionId,
      }),
    ).resolves.toMatchObject({ status: "accepted" });
  });

  it("rejects a message-ID collision with different signed content", async () => {
    const initial = state();
    await database.createSession(initial);
    const first = await request(initial.config.sessionId, "unit-001", 1, "same-message");
    await database.processEnvelope({
      direction: "inbound",
      envelope: first,
      sessionId: initial.config.sessionId,
    });

    const collision = await request(initial.config.sessionId, "unit-002", 2, "same-message");
    await expect(
      database.processEnvelope({
        direction: "inbound",
        envelope: collision,
        sessionId: initial.config.sessionId,
      }),
    ).rejects.toBeInstanceOf(DatabaseInvariantError);
  });

  it("projects an accepted unit and cumulative voucher in the same transaction", async () => {
    const initial = state();
    await database.createSession(initial);
    const requestEnvelope = await request(initial.config.sessionId, "unit-001", 1);
    const deliveryEnvelope = await delivery(initial.config.sessionId, requestEnvelope, 1);
    const acceptanceEnvelope = await acceptance(initial.config.sessionId, deliveryEnvelope, 2, "5");

    for (const envelope of [requestEnvelope, deliveryEnvelope, acceptanceEnvelope]) {
      await database.processEnvelope({
        direction: "inbound",
        envelope,
        sessionId: initial.config.sessionId,
      });
    }

    const [projection] = await admin<
      { billable_amount: string; cumulative_amount: string; status: string }[]
    >`
      select work_units.status, work_units.billable_amount, vouchers.cumulative_amount
      from work_units
      join vouchers using (session_id, work_unit_id)
      where work_units.session_id = ${initial.config.sessionId}
    `;
    expect(projection).toEqual({
      billable_amount: "5",
      cumulative_amount: "5",
      status: "accepted",
    });
  });

  it("updates MPP state atomically and tombstones it without deleting audit data", async () => {
    const initial = state();
    await database.createSession(initial);
    await database.setMppState(initial.config.channelId, { spent: "0", units: 0 });
    const updated = await database.updateMppState(initial.config.channelId, (current) => ({
      ...current,
      spent: "5",
      units: 1,
    }));
    expect(updated).toEqual({ state: { spent: "5", units: 1 }, version: 1n });

    await expect(database.tombstoneMppState(initial.config.channelId)).resolves.toBe(true);
    await expect(database.getMppState(initial.config.channelId)).resolves.toBeNull();
    await expect(
      database.setMppState(initial.config.channelId, { spent: "10", units: 2 }),
    ).rejects.toThrow("cannot be reopened");
    const [audit] = await admin<{ closed: boolean; state: unknown }[]>`
      select closed_at is not null as closed, state
      from mpp_session_state
      where channel_id = ${initial.config.channelId}
    `;
    expect(audit).toEqual({ closed: true, state: { spent: "5", units: 1 } });
  });

  it("claims distinct outbox jobs concurrently and recovers an expired lease", async () => {
    const now = new Date("2026-08-19T12:00:00.000Z");
    const first = await database.enqueueOutbox({
      availableAt: now,
      jobKey: "job-001",
      jobType: "test",
      payload: { value: "one" },
    });
    const duplicate = await database.enqueueOutbox({
      availableAt: now,
      jobKey: "job-001",
      jobType: "test",
      payload: { value: "one" },
    });
    expect(duplicate.id).toBe(first.id);
    await expect(
      database.enqueueOutbox({
        availableAt: now,
        jobKey: "job-001",
        jobType: "test",
        payload: { value: "changed" },
      }),
    ).rejects.toBeInstanceOf(DatabaseInvariantError);
    await database.enqueueOutbox({
      availableAt: now,
      jobKey: "job-002",
      jobType: "test",
      payload: { value: "two" },
    });

    const [workerA, workerB] = await Promise.all([
      database.claimOutbox({ leaseSeconds: 60, limit: 1, now, workerId: "worker-a" }),
      database.claimOutbox({ leaseSeconds: 60, limit: 1, now, workerId: "worker-b" }),
    ]);
    expect(workerA).toHaveLength(1);
    expect(workerB).toHaveLength(1);
    expect(workerA[0]?.id).not.toBe(workerB[0]?.id);

    const leasedJob = workerA[0];
    if (leasedJob === undefined) throw new Error("Expected leased job.");
    await expect(database.completeOutbox(leasedJob.id, "wrong-worker", now)).resolves.toBe(false);
    const reclaimed = await database.claimOutbox({
      leaseSeconds: 60,
      limit: 2,
      now: new Date("2026-08-19T12:01:01.000Z"),
      workerId: "worker-c",
    });
    expect(reclaimed.map(({ id }) => id)).toContain(leasedJob.id);
    await expect(database.completeOutbox(leasedJob.id, "worker-c", now)).resolves.toBe(true);
  });

  it("filters worker claims by job type and reads an idempotent job by key", async () => {
    const now = new Date("2026-08-19T12:00:00.000Z");
    const transport = await database.enqueueOutbox({
      availableAt: now,
      jobKey: "xmtp-request-001",
      jobType: "xmtp.explain-request",
      payload: { messageId: "request-001" },
    });
    await database.enqueueOutbox({
      availableAt: now,
      jobKey: "protocol-event-001",
      jobType: "protocol.event",
      payload: { messageId: "event-001" },
    });

    await expect(database.getOutboxByJobKey(transport.jobKey)).resolves.toMatchObject({
      id: transport.id,
      jobType: "xmtp.explain-request",
    });
    await expect(
      database.claimOutbox({
        jobTypes: ["xmtp.explain-request"],
        leaseSeconds: 60,
        limit: 10,
        now,
        workerId: "xmtp-worker",
      }),
    ).resolves.toEqual([expect.objectContaining({ id: transport.id })]);
  });

  it("records invalid carrier input idempotently and chain-operation intents once", async () => {
    const initial = state();
    await database.createSession(initial);
    await expect(
      database.recordEnvelopeRejection({
        carrierMessageId: "carrier-001",
        rawEnvelope: { malformed: true },
        reason: "invalid_schema",
        sessionId: initial.config.sessionId,
      }),
    ).resolves.toBe(true);
    await expect(
      database.recordEnvelopeRejection({
        carrierMessageId: "carrier-001",
        rawEnvelope: { malformed: true },
        reason: "invalid_schema",
        sessionId: initial.config.sessionId,
      }),
    ).resolves.toBe(false);

    const operation = {
      idempotencyKey: "open-session-001",
      operationType: "open" as const,
      sessionId: initial.config.sessionId,
    };
    await expect(database.startChainOperation(operation)).resolves.toBe(true);
    await expect(database.startChainOperation(operation)).resolves.toBe(false);
    await expect(
      database.startChainOperation({ ...operation, operationType: "close" }),
    ).rejects.toThrow("idempotency key collision");
    await expect(
      database.recordSubmittedChainOperation({
        idempotencyKey: operation.idempotencyKey,
        transactionHash: hashCanonical("open-transaction"),
      }),
    ).resolves.toBe(true);
  });
});
