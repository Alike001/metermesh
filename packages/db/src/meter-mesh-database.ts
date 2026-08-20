import {
  applyVerifiedEnvelope,
  hashCanonical,
  sessionStateSchema,
  validateEnvelope,
  type Envelope,
  type ProtocolEvent,
  type SessionState,
  type WorkUnit,
} from "@metermesh/protocol";
import postgres from "postgres";

import {
  DatabaseInvariantError,
  SessionNotFoundError,
  StaleSessionVersionError,
} from "./errors.js";
import { runMigrations } from "./migrations.js";

interface SessionRow {
  protocol_state: unknown;
  version: string;
}

interface EnvelopeRow {
  payload_hash: string;
  processing_status: "accepted" | "rejected";
  rejection_code: string | null;
}

interface MppStateRow {
  closed_at: Date | null;
  state: unknown;
  version: string;
}

interface ChainOperationRow {
  operation_type: "close" | "open" | "settle";
  session_id: string;
}

interface OutboxRow {
  attempts: string;
  available_at: Date;
  created_at: Date;
  id: string;
  job_key: string;
  job_type: string;
  last_error: string | null;
  lease_expires_at: Date | null;
  payload: unknown;
  processed_at: Date | null;
  session_id: string | null;
  worker_id: string | null;
}

export interface SessionSnapshot {
  state: SessionState;
  version: bigint;
}

export interface OutboxJob {
  attempts: bigint;
  availableAt: Date;
  createdAt: Date;
  id: bigint;
  jobKey: string;
  jobType: string;
  lastError: string | null;
  leaseExpiresAt: Date | null;
  payload: JsonObject;
  processedAt: Date | null;
  sessionId: string | null;
  workerId: string | null;
}

export interface ProcessEnvelopeInput {
  direction: "inbound" | "outbound";
  envelope: unknown;
  sessionId: string;
}

export type ProcessEnvelopeResult =
  | {
      duplicate: boolean;
      event: ProtocolEvent | null;
      snapshot: SessionSnapshot;
      status: "accepted";
    }
  | {
      code: string;
      duplicate: boolean;
      snapshot: SessionSnapshot;
      status: "rejected";
    };

export interface ChainOperationInput {
  idempotencyKey: string;
  operationType: "close" | "open" | "settle";
  sessionId: string;
}

type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

function toJson(value: unknown): postgres.JSONValue {
  if (
    value === undefined ||
    typeof value === "bigint" ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    (typeof value === "number" && !Number.isFinite(value))
  ) {
    throw new DatabaseInvariantError("Value is not JSON serializable.");
  }
  try {
    const serialized = JSON.stringify(value, (_key, item: unknown) => {
      if (
        item === undefined ||
        typeof item === "bigint" ||
        typeof item === "function" ||
        typeof item === "symbol" ||
        (typeof item === "number" && !Number.isFinite(item))
      ) {
        throw new DatabaseInvariantError("Value is not JSON serializable.");
      }
      return item;
    });
    return JSON.parse(serialized) as postgres.JSONValue;
  } catch (error) {
    if (error instanceof DatabaseInvariantError) throw error;
    throw new DatabaseInvariantError("Value is not JSON serializable.");
  }
}

function parseJsonObject(value: unknown, label: string): JsonObject {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new DatabaseInvariantError(`${label} must be a JSON object.`);
  }
  return value as JsonObject;
}

function mapSnapshot(row: SessionRow): SessionSnapshot {
  return {
    state: sessionStateSchema.parse(row.protocol_state),
    version: BigInt(row.version),
  };
}

function mapOutboxJob(row: OutboxRow): OutboxJob {
  return {
    attempts: BigInt(row.attempts),
    availableAt: row.available_at,
    createdAt: row.created_at,
    id: BigInt(row.id),
    jobKey: row.job_key,
    jobType: row.job_type,
    lastError: row.last_error,
    leaseExpiresAt: row.lease_expires_at,
    payload: parseJsonObject(row.payload, "Outbox payload"),
    processedAt: row.processed_at,
    sessionId: row.session_id,
    workerId: row.worker_id,
  };
}

function decisionMessageId(unit: WorkUnit): string | null {
  if (unit.status === "accepted") return unit.acceptanceMessageId;
  if (unit.status === "rejected") return unit.rejectionMessageId;
  return null;
}

function deliveryValue<T>(
  unit: WorkUnit,
  select: (value: Exclude<WorkUnit, { status: "requested" }>) => T,
): T | null {
  return unit.status === "requested" ? null : select(unit);
}

export class MeterMeshDatabase {
  readonly #sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.#sql = sql;
  }

  static connect(
    connectionString: string,
    options: { idleTimeoutSeconds?: number; maxConnections?: number } = {},
  ): MeterMeshDatabase {
    return new MeterMeshDatabase(
      postgres(connectionString, {
        connect_timeout: 10,
        connection: { application_name: "metermesh" },
        idle_timeout: options.idleTimeoutSeconds ?? 20,
        max: options.maxConnections ?? 10,
        onnotice: () => undefined,
      }),
    );
  }

  async migrate(): Promise<void> {
    await runMigrations(this.#sql);
  }

  async close(): Promise<void> {
    await this.#sql.end({ timeout: 5 });
  }

  async createSession(stateInput: SessionState): Promise<SessionSnapshot> {
    const state = sessionStateSchema.parse(stateInput);
    const [row] = await this.#sql<SessionRow[]>`
      insert into sessions (
        session_id,
        channel_id,
        chain_id,
        escrow_address,
        token_address,
        buyer_address,
        buyer_inbox_id,
        seller_address,
        seller_inbox_id,
        unit_price,
        cap,
        highest_voucher_amount,
        accepted_units,
        rejected_units,
        status,
        protocol_state
      ) values (
        ${state.config.sessionId},
        ${state.config.channelId},
        ${state.config.chainId},
        ${state.config.escrowAddress},
        ${state.config.tokenAddress},
        ${state.config.buyer.address},
        ${state.config.buyer.inboxId},
        ${state.config.seller.address},
        ${state.config.seller.inboxId},
        ${state.config.unitPrice},
        ${state.config.cap},
        ${state.highestVoucherAmount},
        ${state.acceptedUnits},
        ${state.rejectedUnits},
        ${state.status},
        ${this.#sql.json(toJson(state))}
      )
      returning protocol_state, version
    `;
    if (row === undefined) throw new DatabaseInvariantError("Session insert returned no row.");
    return mapSnapshot(row);
  }

  async getSession(sessionId: string): Promise<SessionSnapshot | null> {
    const [row] = await this.#sql<SessionRow[]>`
      select protocol_state, version from sessions where session_id = ${sessionId}
    `;
    return row === undefined ? null : mapSnapshot(row);
  }

  async updateSession(
    sessionId: string,
    expectedVersion: bigint,
    mutator: (state: SessionState) => SessionState,
  ): Promise<SessionSnapshot> {
    return this.#sql.begin(async (transaction) => {
      const [row] = await transaction<SessionRow[]>`
        select protocol_state, version
        from sessions
        where session_id = ${sessionId}
        for update
      `;
      if (row === undefined) throw new SessionNotFoundError(`Session ${sessionId} was not found.`);
      if (BigInt(row.version) !== expectedVersion) {
        throw new StaleSessionVersionError(
          `Session ${sessionId} expected version ${String(expectedVersion)}, found ${row.version}.`,
        );
      }

      const currentState = sessionStateSchema.parse(row.protocol_state);
      const nextState = sessionStateSchema.parse(mutator(currentState));
      if (hashCanonical(currentState.config) !== hashCanonical(nextState.config)) {
        throw new DatabaseInvariantError("Session configuration is immutable after creation.");
      }
      const [updated] = await transaction<SessionRow[]>`
        update sessions
        set
          protocol_state = ${transaction.json(toJson(nextState))},
          highest_voucher_amount = ${nextState.highestVoucherAmount},
          accepted_units = ${nextState.acceptedUnits},
          rejected_units = ${nextState.rejectedUnits},
          status = ${nextState.status},
          settlement_transaction_hash = ${nextState.settlement?.transactionHash ?? null},
          version = version + 1,
          updated_at = now()
        where session_id = ${sessionId}
        returning protocol_state, version
      `;
      if (updated === undefined)
        throw new DatabaseInvariantError("Session update returned no row.");
      await this.#syncWorkUnits(transaction, nextState);
      return mapSnapshot(updated);
    });
  }

  async processEnvelope(input: ProcessEnvelopeInput): Promise<ProcessEnvelopeResult> {
    const validation = await validateEnvelope(input.envelope);
    if (!validation.ok) {
      throw new DatabaseInvariantError(`Envelope validation failed: ${validation.error.code}.`);
    }
    const envelope = validation.envelope;
    if (envelope.sessionId !== input.sessionId) {
      throw new DatabaseInvariantError("Envelope and repository session IDs differ.");
    }

    return this.#sql.begin(async (transaction) => {
      const [sessionRow] = await transaction<SessionRow[]>`
        select protocol_state, version
        from sessions
        where session_id = ${input.sessionId}
        for update
      `;
      if (sessionRow === undefined) {
        throw new SessionNotFoundError(`Session ${input.sessionId} was not found.`);
      }
      const snapshot = mapSnapshot(sessionRow);

      const [existing] = await transaction<EnvelopeRow[]>`
        select payload_hash, processing_status, rejection_code
        from envelopes
        where message_id = ${envelope.messageId}
      `;
      if (existing !== undefined) {
        if (existing.payload_hash !== envelope.payloadHash) {
          throw new DatabaseInvariantError("Message ID collision has a different payload hash.");
        }
        return existing.processing_status === "accepted"
          ? { duplicate: true, event: null, snapshot, status: "accepted" }
          : {
              code: existing.rejection_code ?? "rejected",
              duplicate: true,
              snapshot,
              status: "rejected",
            };
      }

      const result = applyVerifiedEnvelope(snapshot.state, envelope);
      if (!result.ok) {
        await this.#insertEnvelope(
          transaction,
          envelope,
          input.direction,
          "rejected",
          result.error.code,
        );
        return {
          code: result.error.code,
          duplicate: false,
          snapshot,
          status: "rejected",
        };
      }

      await this.#insertEnvelope(transaction, envelope, input.direction, "accepted", null);
      const [updated] = await transaction<SessionRow[]>`
        update sessions
        set
          protocol_state = ${transaction.json(toJson(result.state))},
          highest_voucher_amount = ${result.state.highestVoucherAmount},
          accepted_units = ${result.state.acceptedUnits},
          rejected_units = ${result.state.rejectedUnits},
          status = ${result.state.status},
          version = version + 1,
          updated_at = now()
        where session_id = ${input.sessionId}
        returning protocol_state, version
      `;
      if (updated === undefined)
        throw new DatabaseInvariantError("Session update returned no row.");
      await this.#syncWorkUnits(transaction, result.state);
      if (envelope.type === "work.accept") {
        await transaction`
          insert into vouchers (
            session_id,
            work_unit_id,
            cumulative_amount,
            credential_hash
          ) values (
            ${input.sessionId},
            ${envelope.payload.workUnitId},
            ${envelope.payload.cumulativeAmount},
            ${envelope.payload.voucherCredentialHash}
          )
          on conflict (session_id, work_unit_id) do nothing
        `;
      }
      await this.#enqueueWithSql(
        transaction,
        `protocol-event:${envelope.messageId}`,
        "protocol.event",
        toJson(result.event) as JsonObject,
        input.sessionId,
        new Date(),
      );

      return {
        duplicate: false,
        event: result.event,
        snapshot: mapSnapshot(updated),
        status: "accepted",
      };
    });
  }

  async recordEnvelopeRejection(input: {
    carrierMessageId: string;
    rawEnvelope: JsonValue;
    reason: string;
    sessionId?: string;
  }): Promise<boolean> {
    const rows = await this.#sql<{ id: string }[]>`
      insert into envelope_rejections (
        carrier_message_id,
        session_id,
        reason,
        raw_envelope
      ) values (
        ${input.carrierMessageId},
        ${input.sessionId ?? null},
        ${input.reason},
        ${this.#sql.json(toJson(input.rawEnvelope))}
      )
      on conflict (carrier_message_id) do nothing
      returning id
    `;
    return rows.length === 1;
  }

  async setMppState(channelId: string, state: JsonObject): Promise<void> {
    const rows = await this.#sql<{ channel_id: string }[]>`
      insert into mpp_session_state (channel_id, state)
      values (${channelId}, ${this.#sql.json(toJson(state))})
      on conflict (channel_id) do update
      set state = excluded.state, version = mpp_session_state.version + 1,
          updated_at = now()
      where mpp_session_state.closed_at is null
      returning channel_id
    `;
    if (rows.length !== 1) {
      throw new DatabaseInvariantError("Tombstoned MPP state cannot be reopened.");
    }
  }

  async getMppState(channelId: string): Promise<{ state: JsonObject; version: bigint } | null> {
    const [row] = await this.#sql<MppStateRow[]>`
      select state, version, closed_at
      from mpp_session_state
      where channel_id = ${channelId}
    `;
    if (row?.closed_at !== null) return null;
    return { state: parseJsonObject(row.state, "MPP state"), version: BigInt(row.version) };
  }

  async updateMppState(
    channelId: string,
    mutator: (state: JsonObject) => JsonObject,
  ): Promise<{ state: JsonObject; version: bigint }> {
    return this.#sql.begin(async (transaction) => {
      const [row] = await transaction<MppStateRow[]>`
        select state, version, closed_at
        from mpp_session_state
        where channel_id = ${channelId}
        for update
      `;
      if (row?.closed_at !== null) {
        throw new SessionNotFoundError(`Active MPP state for ${channelId} was not found.`);
      }
      const state = parseJsonObject(
        toJson(mutator(parseJsonObject(row.state, "MPP state"))),
        "MPP state",
      );
      const [updated] = await transaction<MppStateRow[]>`
        update mpp_session_state
        set state = ${transaction.json(toJson(state))}, version = version + 1, updated_at = now()
        where channel_id = ${channelId}
        returning state, version, closed_at
      `;
      if (updated === undefined) throw new DatabaseInvariantError("MPP update returned no row.");
      return {
        state: parseJsonObject(updated.state, "MPP state"),
        version: BigInt(updated.version),
      };
    });
  }

  async tombstoneMppState(channelId: string): Promise<boolean> {
    const rows = await this.#sql<{ channel_id: string }[]>`
      update mpp_session_state
      set closed_at = coalesce(closed_at, now()), updated_at = now()
      where channel_id = ${channelId}
      returning channel_id
    `;
    return rows.length === 1;
  }

  async enqueueOutbox(input: {
    availableAt?: Date;
    jobKey: string;
    jobType: string;
    payload: JsonObject;
    sessionId?: string;
  }): Promise<OutboxJob> {
    return this.#enqueueWithSql(
      this.#sql,
      input.jobKey,
      input.jobType,
      input.payload,
      input.sessionId ?? null,
      input.availableAt ?? new Date(),
    );
  }

  async claimOutbox(input: {
    jobTypes?: string[];
    leaseSeconds: number;
    limit: number;
    now?: Date;
    workerId: string;
  }): Promise<OutboxJob[]> {
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
      throw new DatabaseInvariantError("Outbox claim limit must be between 1 and 100.");
    }
    if (!Number.isSafeInteger(input.leaseSeconds) || input.leaseSeconds < 1) {
      throw new DatabaseInvariantError("Outbox lease must be a positive number of seconds.");
    }
    if (
      input.jobTypes !== undefined &&
      (input.jobTypes.length < 1 ||
        input.jobTypes.length > 20 ||
        input.jobTypes.some((jobType) => jobType.trim() === ""))
    ) {
      throw new DatabaseInvariantError("Outbox job-type filter must contain 1 to 20 names.");
    }
    const now = input.now ?? new Date();
    const typeFilter =
      input.jobTypes === undefined
        ? this.#sql``
        : this.#sql`and job_type in ${this.#sql(input.jobTypes)}`;
    const rows = await this.#sql<OutboxRow[]>`
      with candidates as (
        select id
        from outbox
        where processed_at is null
          and available_at <= ${now}
          and (lease_expires_at is null or lease_expires_at <= ${now})
          ${typeFilter}
        order by available_at, id
        limit ${input.limit}
        for update skip locked
      )
      update outbox as jobs
      set
        attempts = jobs.attempts + 1,
        lease_expires_at = ${now} + make_interval(secs => ${input.leaseSeconds}),
        worker_id = ${input.workerId},
        updated_at = ${now}
      from candidates
      where jobs.id = candidates.id
      returning jobs.*
    `;
    return rows.map(mapOutboxJob);
  }

  async getOutboxByJobKey(jobKey: string): Promise<OutboxJob | null> {
    const [row] = await this.#sql<OutboxRow[]>`
      select * from outbox where job_key = ${jobKey}
    `;
    return row === undefined ? null : mapOutboxJob(row);
  }

  async completeOutbox(
    jobId: bigint,
    workerId: string,
    completedAt = new Date(),
  ): Promise<boolean> {
    const rows = await this.#sql<{ id: string }[]>`
      update outbox
      set
        processed_at = ${completedAt},
        lease_expires_at = null,
        worker_id = null,
        updated_at = ${completedAt}
      where id = ${String(jobId)} and worker_id = ${workerId} and processed_at is null
      returning id
    `;
    return rows.length === 1;
  }

  async failOutbox(input: {
    availableAt: Date;
    error: string;
    jobId: bigint;
    workerId: string;
  }): Promise<boolean> {
    const rows = await this.#sql<{ id: string }[]>`
      update outbox
      set
        available_at = ${input.availableAt},
        last_error = ${input.error},
        lease_expires_at = null,
        worker_id = null,
        updated_at = now()
      where id = ${String(input.jobId)} and worker_id = ${input.workerId} and processed_at is null
      returning id
    `;
    return rows.length === 1;
  }

  async startChainOperation(input: ChainOperationInput): Promise<boolean> {
    const rows = await this.#sql<{ id: string }[]>`
      insert into chain_operations (
        idempotency_key,
        session_id,
        operation_type,
        operation_state
      ) values (
        ${input.idempotencyKey},
        ${input.sessionId},
        ${input.operationType},
        'pending'
      )
      on conflict (idempotency_key) do nothing
      returning id
    `;
    if (rows.length === 1) return true;
    const [existing] = await this.#sql<ChainOperationRow[]>`
      select session_id, operation_type
      from chain_operations
      where idempotency_key = ${input.idempotencyKey}
    `;
    if (existing?.session_id !== input.sessionId) {
      throw new DatabaseInvariantError("Chain-operation idempotency key collision.");
    }
    if (existing.operation_type !== input.operationType) {
      throw new DatabaseInvariantError("Chain-operation idempotency key collision.");
    }
    return false;
  }

  async recordSubmittedChainOperation(input: {
    idempotencyKey: string;
    transactionHash: string;
  }): Promise<boolean> {
    const rows = await this.#sql<{ id: string }[]>`
      update chain_operations
      set
        operation_state = 'submitted',
        transaction_hash = ${input.transactionHash},
        updated_at = now()
      where idempotency_key = ${input.idempotencyKey} and operation_state = 'pending'
      returning id
    `;
    return rows.length === 1;
  }

  async #insertEnvelope(
    transaction: postgres.TransactionSql,
    envelope: Envelope,
    direction: "inbound" | "outbound",
    processingStatus: "accepted" | "rejected",
    rejectionCode: string | null,
  ): Promise<void> {
    const workUnitId = "workUnitId" in envelope.payload ? envelope.payload.workUnitId : null;
    await transaction`
      insert into envelopes (
        session_id,
        message_id,
        work_unit_id,
        sender_inbox_id,
        sequence,
        envelope_type,
        payload_hash,
        signature_signer,
        direction,
        processing_status,
        rejection_code,
        envelope
      ) values (
        ${envelope.sessionId},
        ${envelope.messageId},
        ${workUnitId},
        ${envelope.senderInboxId},
        ${envelope.sequence},
        ${envelope.type},
        ${envelope.payloadHash},
        ${envelope.signature.signer},
        ${direction},
        ${processingStatus},
        ${rejectionCode},
        ${transaction.json(toJson(envelope))}
      )
    `;
  }

  async #syncWorkUnits(transaction: postgres.TransactionSql, state: SessionState): Promise<void> {
    for (const unit of state.workUnits) {
      const deliveryMessageId = deliveryValue(unit, (value) => value.deliveryMessageId);
      const deliveryPayloadHash = deliveryValue(unit, (value) => value.deliveryPayloadHash);
      const resultHash = deliveryValue(unit, (value) => value.resultHash);
      const billableAmount = unit.status === "accepted" ? state.config.unitPrice : "0";
      const cumulativeAmount = unit.status === "accepted" ? unit.cumulativeAmount : null;
      const rejectionReason = unit.status === "rejected" ? unit.reason : null;
      await transaction`
        insert into work_units (
          session_id,
          work_unit_id,
          transaction_hash,
          status,
          request_message_id,
          delivery_message_id,
          delivery_payload_hash,
          result_hash,
          decision_message_id,
          rejection_reason,
          billable_amount,
          cumulative_amount
        ) values (
          ${state.config.sessionId},
          ${unit.workUnitId},
          ${unit.transactionHash},
          ${unit.status},
          ${unit.requestMessageId},
          ${deliveryMessageId},
          ${deliveryPayloadHash},
          ${resultHash},
          ${decisionMessageId(unit)},
          ${rejectionReason},
          ${billableAmount},
          ${cumulativeAmount}
        )
        on conflict (session_id, work_unit_id) do update
        set
          status = excluded.status,
          delivery_message_id = excluded.delivery_message_id,
          delivery_payload_hash = excluded.delivery_payload_hash,
          result_hash = excluded.result_hash,
          decision_message_id = excluded.decision_message_id,
          rejection_reason = excluded.rejection_reason,
          billable_amount = excluded.billable_amount,
          cumulative_amount = excluded.cumulative_amount,
          updated_at = now()
      `;
    }
  }

  async #enqueueWithSql(
    sql: postgres.Sql | postgres.TransactionSql,
    jobKey: string,
    jobType: string,
    payload: JsonObject,
    sessionId: string | null,
    availableAt: Date,
  ): Promise<OutboxJob> {
    const rows = await sql<OutboxRow[]>`
      insert into outbox (
        job_key,
        session_id,
        job_type,
        payload,
        available_at
      ) values (
        ${jobKey},
        ${sessionId},
        ${jobType},
        ${sql.json(toJson(payload))},
        ${availableAt}
      )
      on conflict (job_key) do nothing
      returning *
    `;
    const inserted = rows[0];
    if (inserted !== undefined) return mapOutboxJob(inserted);
    const [row] = await sql<OutboxRow[]>`
      select * from outbox where job_key = ${jobKey}
    `;
    if (row === undefined) throw new DatabaseInvariantError("Outbox enqueue returned no row.");
    const existingPayload = parseJsonObject(row.payload, "Outbox payload");
    if (
      row.job_type !== jobType ||
      row.session_id !== sessionId ||
      hashCanonical(existingPayload) !== hashCanonical(payload)
    ) {
      throw new DatabaseInvariantError("Outbox job-key collision has different content.");
    }
    return mapOutboxJob(row);
  }
}
