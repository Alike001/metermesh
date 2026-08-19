import type { Address } from "viem";

import { validateEnvelope } from "./envelope.js";
import {
  sessionConfigSchema,
  sessionStateSchema,
  settlementReceiptSchema,
  type Envelope,
  type SessionConfig,
  type SessionState,
  type SettlementReceipt,
  type WorkUnit,
} from "./schema.js";

export type ProtocolErrorCode =
  | "cap_exceeded"
  | "final_amount_mismatch"
  | "invalid_envelope"
  | "invalid_settlement_receipt"
  | "invalid_session_state"
  | "invalid_work_state"
  | "out_of_order"
  | "reference_mismatch"
  | "replayed_message"
  | "role_not_allowed"
  | "session_not_closing"
  | "session_not_open"
  | "unknown_sender"
  | "voucher_amount_invalid"
  | "work_unit_exists"
  | "work_unit_not_found"
  | "wrong_session";

export type ProtocolResult =
  | { event: ProtocolEvent; ok: true; state: SessionState }
  | { error: { code: ProtocolErrorCode; message: string }; ok: false };

export type ProtocolEvent =
  | { messageId: string; type: "work_requested"; workUnitId: string }
  | { messageId: string; type: "work_delivered"; workUnitId: string }
  | { amount: string; messageId: string; type: "work_accepted"; workUnitId: string }
  | { messageId: string; type: "work_rejected"; workUnitId: string }
  | { amount: string; messageId: string; type: "close_requested" }
  | { amount: string; transactionHash: string; type: "settlement_confirmed" };

type ActorRole = "buyer" | "seller";

function fail(code: ProtocolErrorCode, message: string): ProtocolResult {
  return { error: { code, message }, ok: false };
}

function cloneState(state: SessionState): SessionState {
  return {
    ...state,
    config: {
      ...state.config,
      buyer: { ...state.config.buyer },
      seller: { ...state.config.seller },
    },
    closeRequest: state.closeRequest === null ? null : { ...state.closeRequest },
    lastSequences: state.lastSequences.map((entry) => ({ ...entry })),
    processedMessageIds: [...state.processedMessageIds],
    settlement: state.settlement === null ? null : { ...state.settlement },
    workUnits: state.workUnits.map((unit) => ({ ...unit })),
  };
}

function actorFor(state: SessionState, envelope: Envelope): ActorRole | null {
  const matches = (party: { address: Address; inboxId: string }) =>
    party.inboxId === envelope.senderInboxId && party.address === envelope.signature.signer;
  if (matches(state.config.buyer)) return "buyer";
  if (matches(state.config.seller)) return "seller";
  return null;
}

function expectedSequence(state: SessionState, inboxId: string): number {
  return (state.lastSequences.find((entry) => entry.inboxId === inboxId)?.sequence ?? 0) + 1;
}

function commitMessage(state: SessionState, envelope: Envelope): void {
  const sequenceEntry = state.lastSequences.find(
    (entry) => entry.inboxId === envelope.senderInboxId,
  );
  if (sequenceEntry === undefined) {
    state.lastSequences.push({ inboxId: envelope.senderInboxId, sequence: envelope.sequence });
  } else {
    sequenceEntry.sequence = envelope.sequence;
  }
  state.processedMessageIds.push(envelope.messageId);
}

function findWorkUnit(state: SessionState, workUnitId: string): WorkUnit | undefined {
  return state.workUnits.find((unit) => unit.workUnitId === workUnitId);
}

function replaceWorkUnit(state: SessionState, nextUnit: WorkUnit): void {
  state.workUnits = state.workUnits.map((unit) =>
    unit.workUnitId === nextUnit.workUnitId ? nextUnit : unit,
  );
}

function requireOpen(state: SessionState): ProtocolResult | null {
  return state.status === "open"
    ? null
    : fail("session_not_open", `Session is ${state.status} and cannot accept messages.`);
}

function applyRequest(state: SessionState, envelope: Extract<Envelope, { type: "work.request" }>) {
  const openError = requireOpen(state);
  if (openError !== null) return openError;
  if (findWorkUnit(state, envelope.payload.workUnitId) !== undefined) {
    return fail("work_unit_exists", "Work-unit ID already exists in this session.");
  }
  state.workUnits.push({
    requestMessageId: envelope.messageId,
    status: "requested",
    transactionHash: envelope.payload.transactionHash,
    workUnitId: envelope.payload.workUnitId,
  });
  commitMessage(state, envelope);
  return {
    event: {
      messageId: envelope.messageId,
      type: "work_requested" as const,
      workUnitId: envelope.payload.workUnitId,
    },
    ok: true as const,
    state,
  };
}

function applyDelivery(
  state: SessionState,
  envelope: Extract<Envelope, { type: "work.delivery" }>,
) {
  const openError = requireOpen(state);
  if (openError !== null) return openError;
  const unit = findWorkUnit(state, envelope.payload.workUnitId);
  if (unit === undefined) return fail("work_unit_not_found", "Delivery has no matching request.");
  if (unit.status !== "requested") {
    return fail("invalid_work_state", `Cannot deliver work in ${unit.status} state.`);
  }
  if (
    unit.requestMessageId !== envelope.payload.requestMessageId ||
    unit.transactionHash !== envelope.payload.transactionHash
  ) {
    return fail("reference_mismatch", "Delivery does not match its request evidence.");
  }
  replaceWorkUnit(state, {
    ...unit,
    deliveryMessageId: envelope.messageId,
    deliveryPayloadHash: envelope.payloadHash,
    resultHash: envelope.payload.resultHash,
    status: "delivered",
  });
  commitMessage(state, envelope);
  return {
    event: {
      messageId: envelope.messageId,
      type: "work_delivered" as const,
      workUnitId: envelope.payload.workUnitId,
    },
    ok: true as const,
    state,
  };
}

function applyAcceptance(
  state: SessionState,
  envelope: Extract<Envelope, { type: "work.accept" }>,
) {
  const openError = requireOpen(state);
  if (openError !== null) return openError;
  const unit = findWorkUnit(state, envelope.payload.workUnitId);
  if (unit === undefined)
    return fail("work_unit_not_found", "Acceptance has no matching delivery.");
  if (unit.status !== "delivered") {
    return fail("invalid_work_state", `Cannot accept work in ${unit.status} state.`);
  }
  if (
    unit.deliveryMessageId !== envelope.payload.deliveryMessageId ||
    unit.deliveryPayloadHash !== envelope.payload.deliveryPayloadHash
  ) {
    return fail("reference_mismatch", "Acceptance does not match its delivery evidence.");
  }

  const nextAmount = BigInt(state.highestVoucherAmount) + BigInt(state.config.unitPrice);
  if (BigInt(envelope.payload.cumulativeAmount) !== nextAmount) {
    return fail(
      "voucher_amount_invalid",
      `Expected cumulative amount ${String(nextAmount)}, received ${envelope.payload.cumulativeAmount}.`,
    );
  }
  if (nextAmount > BigInt(state.config.cap)) {
    return fail("cap_exceeded", "Cumulative voucher would exceed the funded cap.");
  }

  replaceWorkUnit(state, {
    ...unit,
    acceptanceMessageId: envelope.messageId,
    cumulativeAmount: envelope.payload.cumulativeAmount,
    status: "accepted",
    voucherCredentialHash: envelope.payload.voucherCredentialHash,
  });
  state.acceptedUnits += 1;
  state.highestVoucherAmount = envelope.payload.cumulativeAmount;
  commitMessage(state, envelope);
  return {
    event: {
      amount: envelope.payload.cumulativeAmount,
      messageId: envelope.messageId,
      type: "work_accepted" as const,
      workUnitId: envelope.payload.workUnitId,
    },
    ok: true as const,
    state,
  };
}

function applyRejection(state: SessionState, envelope: Extract<Envelope, { type: "work.reject" }>) {
  const openError = requireOpen(state);
  if (openError !== null) return openError;
  const unit = findWorkUnit(state, envelope.payload.workUnitId);
  if (unit === undefined) return fail("work_unit_not_found", "Rejection has no matching delivery.");
  if (unit.status !== "delivered") {
    return fail("invalid_work_state", `Cannot reject work in ${unit.status} state.`);
  }
  if (
    unit.deliveryMessageId !== envelope.payload.deliveryMessageId ||
    unit.deliveryPayloadHash !== envelope.payload.deliveryPayloadHash
  ) {
    return fail("reference_mismatch", "Rejection does not match its delivery evidence.");
  }
  replaceWorkUnit(state, {
    ...unit,
    reason: envelope.payload.reason,
    rejectionMessageId: envelope.messageId,
    status: "rejected",
  });
  state.rejectedUnits += 1;
  commitMessage(state, envelope);
  return {
    event: {
      messageId: envelope.messageId,
      type: "work_rejected" as const,
      workUnitId: envelope.payload.workUnitId,
    },
    ok: true as const,
    state,
  };
}

function applyClose(state: SessionState, envelope: Extract<Envelope, { type: "session.close" }>) {
  const openError = requireOpen(state);
  if (openError !== null) return openError;
  if (envelope.payload.finalCumulativeAmount !== state.highestVoucherAmount) {
    return fail("final_amount_mismatch", "Close amount must equal the highest accepted voucher.");
  }
  state.status = "closing";
  state.closeRequest = {
    closeCredentialHash: envelope.payload.closeCredentialHash,
    messageId: envelope.messageId,
  };
  commitMessage(state, envelope);
  return {
    event: {
      amount: envelope.payload.finalCumulativeAmount,
      messageId: envelope.messageId,
      type: "close_requested" as const,
    },
    ok: true as const,
    state,
  };
}

export function createSessionState(input: SessionConfig): SessionState {
  const config = sessionConfigSchema.parse(input);
  return sessionStateSchema.parse({
    acceptedUnits: 0,
    closeRequest: null,
    config,
    highestVoucherAmount: "0",
    lastSequences: [],
    processedMessageIds: [],
    protocolVersion: 1,
    rejectedUnits: 0,
    settlement: null,
    status: "open",
    workUnits: [],
  });
}

export async function applyEnvelope(
  stateInput: SessionState,
  input: unknown,
): Promise<ProtocolResult> {
  const parsedState = sessionStateSchema.safeParse(stateInput);
  if (!parsedState.success) {
    return fail("invalid_session_state", "Stored session state failed its invariants.");
  }
  const validation = await validateEnvelope(input);
  if (!validation.ok) {
    return fail("invalid_envelope", validation.error.code);
  }

  return applyVerifiedEnvelope(parsedState.data, validation.envelope);
}

export function applyVerifiedEnvelope(
  stateInput: SessionState,
  envelope: Envelope,
): ProtocolResult {
  const parsedState = sessionStateSchema.safeParse(stateInput);
  if (!parsedState.success) {
    return fail("invalid_session_state", "Stored session state failed its invariants.");
  }
  const state = cloneState(parsedState.data);
  if (envelope.sessionId !== state.config.sessionId) {
    return fail("wrong_session", "Envelope session ID does not match stored state.");
  }
  const actor = actorFor(state, envelope);
  if (actor === null) return fail("unknown_sender", "Sender inbox and signer are not authorized.");
  const expectedRole: ActorRole = envelope.type === "work.delivery" ? "seller" : "buyer";
  if (actor !== expectedRole) {
    return fail("role_not_allowed", `${actor} cannot send ${envelope.type}.`);
  }
  if (state.processedMessageIds.includes(envelope.messageId)) {
    return fail("replayed_message", "Message ID has already been processed.");
  }
  const expected = expectedSequence(state, envelope.senderInboxId);
  if (envelope.sequence !== expected) {
    return fail(
      "out_of_order",
      `Expected sequence ${String(expected)}, received ${String(envelope.sequence)}.`,
    );
  }

  let result: ProtocolResult;
  switch (envelope.type) {
    case "work.request":
      result = applyRequest(state, envelope);
      break;
    case "work.delivery":
      result = applyDelivery(state, envelope);
      break;
    case "work.accept":
      result = applyAcceptance(state, envelope);
      break;
    case "work.reject":
      result = applyRejection(state, envelope);
      break;
    case "session.close":
      result = applyClose(state, envelope);
      break;
  }
  return result.ok ? { ...result, state: sessionStateSchema.parse(result.state) } : result;
}

export function applyVerifiedSettlement(
  stateInput: SessionState,
  receiptInput: unknown,
): ProtocolResult {
  const parsedState = sessionStateSchema.safeParse(stateInput);
  if (!parsedState.success) {
    return fail("invalid_session_state", "Stored session state failed its invariants.");
  }
  if (parsedState.data.status !== "closing") {
    return fail("session_not_closing", "Settlement requires a closing session.");
  }
  const parsedReceipt = settlementReceiptSchema.safeParse(receiptInput);
  if (!parsedReceipt.success) {
    return fail("invalid_settlement_receipt", "Settlement receipt failed schema validation.");
  }
  const receipt: SettlementReceipt = parsedReceipt.data;
  if (
    receipt.chainId !== parsedState.data.config.chainId ||
    receipt.channelId !== parsedState.data.config.channelId ||
    receipt.amount !== parsedState.data.highestVoucherAmount
  ) {
    return fail("final_amount_mismatch", "Settlement receipt does not match the session.");
  }
  const state = cloneState(parsedState.data);
  state.settlement = receipt;
  state.status = "closed";
  const validated = sessionStateSchema.parse(state);
  return {
    event: {
      amount: receipt.amount,
      transactionHash: receipt.transactionHash,
      type: "settlement_confirmed",
    },
    ok: true,
    state: validated,
  };
}
