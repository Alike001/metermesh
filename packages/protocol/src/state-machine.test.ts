import { getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { beforeEach, describe, expect, it } from "vitest";

import { hashCanonical } from "./canonical.js";
import { signEnvelope } from "./envelope.js";
import {
  applyEnvelope,
  applyVerifiedSettlement,
  createSessionState,
  type ProtocolResult,
} from "./state-machine.js";
import type { Envelope, SessionConfig, SessionState } from "./schema.js";

const createdAt = "2026-08-19T12:00:00.000Z";
const sessionId = "session-001";
const buyerInboxId = "buyer-inbox";
const sellerInboxId = "seller-inbox";
const escrowAddress = getAddress("0x5E550002e64FaF79B41D89fE8439eEb1be66CE3b");
const tokenAddress = getAddress("0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c");

let buyer: PrivateKeyAccount;
let seller: PrivateKeyAccount;

beforeEach(() => {
  buyer = privateKeyToAccount(generatePrivateKey());
  seller = privateKeyToAccount(generatePrivateKey());
});

function config(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    buyer: { address: buyer.address, inboxId: buyerInboxId },
    cap: "15",
    chainId: 1952,
    channelId: hashCanonical("channel-001"),
    escrowAddress,
    seller: { address: seller.address, inboxId: sellerInboxId },
    sessionId,
    tokenAddress,
    unitPrice: "5",
    ...overrides,
  };
}

function header(
  actor: "buyer" | "seller",
  messageId: string,
  sequence: number,
): {
  createdAt: string;
  messageId: string;
  protocol: "metermesh";
  senderInboxId: string;
  sequence: number;
  sessionId: string;
  version: 1;
} {
  return {
    createdAt,
    messageId,
    protocol: "metermesh",
    senderInboxId: actor === "buyer" ? buyerInboxId : sellerInboxId,
    sequence,
    sessionId,
    version: 1,
  };
}

async function request(
  workUnitId: string,
  sequence: number,
  messageId = `request-${workUnitId}`,
  signer = buyer,
): Promise<Envelope> {
  return signEnvelope(
    {
      ...header("buyer", messageId, sequence),
      payload: { transactionHash: hashCanonical(`tx-${workUnitId}`), workUnitId },
      type: "work.request",
    },
    signer,
  );
}

async function delivery(
  requestEnvelope: Extract<Envelope, { type: "work.request" }>,
  sequence: number,
  options: { messageId?: string; transactionHash?: `0x${string}` } = {},
): Promise<Envelope> {
  return signEnvelope(
    {
      ...header(
        "seller",
        options.messageId ?? `delivery-${requestEnvelope.payload.workUnitId}`,
        sequence,
      ),
      payload: {
        deliverySchema: "metermesh.transaction-explanation.v1",
        requestMessageId: requestEnvelope.messageId,
        resultHash: hashCanonical(`result-${requestEnvelope.payload.workUnitId}`),
        transactionHash: options.transactionHash ?? requestEnvelope.payload.transactionHash,
        workUnitId: requestEnvelope.payload.workUnitId,
      },
      type: "work.delivery",
    },
    seller,
  );
}

async function acceptance(
  deliveryEnvelope: Extract<Envelope, { type: "work.delivery" }>,
  sequence: number,
  cumulativeAmount: string,
  messageId = `accept-${deliveryEnvelope.payload.workUnitId}`,
): Promise<Envelope> {
  return signEnvelope(
    {
      ...header("buyer", messageId, sequence),
      payload: {
        cumulativeAmount,
        deliveryMessageId: deliveryEnvelope.messageId,
        deliveryPayloadHash: deliveryEnvelope.payloadHash,
        voucherCredentialHash: hashCanonical(`voucher-${messageId}`),
        workUnitId: deliveryEnvelope.payload.workUnitId,
      },
      type: "work.accept",
    },
    buyer,
  );
}

async function rejection(
  deliveryEnvelope: Extract<Envelope, { type: "work.delivery" }>,
  sequence: number,
): Promise<Envelope> {
  return signEnvelope(
    {
      ...header("buyer", `reject-${deliveryEnvelope.payload.workUnitId}`, sequence),
      payload: {
        deliveryMessageId: deliveryEnvelope.messageId,
        deliveryPayloadHash: deliveryEnvelope.payloadHash,
        reason: "buyer_declined",
        workUnitId: deliveryEnvelope.payload.workUnitId,
      },
      type: "work.reject",
    },
    buyer,
  );
}

async function workError(
  requestEnvelope: Extract<Envelope, { type: "work.request" }>,
  sequence: number,
  overrides: { requestMessageId?: string; transactionHash?: `0x${string}` } = {},
): Promise<Envelope> {
  return signEnvelope(
    {
      ...header("seller", `error-${requestEnvelope.payload.workUnitId}`, sequence),
      payload: {
        code: "trial_capacity_reached",
        detail: "The public verification capacity has been used.",
        requestMessageId: overrides.requestMessageId ?? requestEnvelope.messageId,
        retryable: false,
        transactionHash: overrides.transactionHash ?? requestEnvelope.payload.transactionHash,
        workUnitId: requestEnvelope.payload.workUnitId,
      },
      type: "work.error",
    },
    seller,
  );
}

async function close(sequence: number, finalCumulativeAmount: string): Promise<Envelope> {
  return signEnvelope(
    {
      ...header("buyer", "close-001", sequence),
      payload: {
        closeCredentialHash: hashCanonical("close-credential"),
        finalCumulativeAmount,
      },
      type: "session.close",
    },
    buyer,
  );
}

async function mustApply(state: SessionState, envelope: Envelope): Promise<SessionState> {
  const result = await applyEnvelope(state, envelope);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function expectError(result: ProtocolResult, code: string): void {
  expect(result).toMatchObject({ error: { code }, ok: false });
}

async function deliveredState(): Promise<{
  deliveryEnvelope: Extract<Envelope, { type: "work.delivery" }>;
  requestEnvelope: Extract<Envelope, { type: "work.request" }>;
  state: SessionState;
}> {
  const requestEnvelope = (await request("unit-001", 1)) as Extract<
    Envelope,
    { type: "work.request" }
  >;
  const deliveryEnvelope = (await delivery(requestEnvelope, 1)) as Extract<
    Envelope,
    { type: "work.delivery" }
  >;
  let state = createSessionState(config());
  state = await mustApply(state, requestEnvelope);
  state = await mustApply(state, deliveryEnvelope);
  return { deliveryEnvelope, requestEnvelope, state };
}

describe("MeterMesh state machine", () => {
  it("runs two accepted units, one rejected unit, close, and confirmed settlement", async () => {
    let state = createSessionState(config());

    const requestOne = (await request("unit-001", 1)) as Extract<
      Envelope,
      { type: "work.request" }
    >;
    const deliveryOne = (await delivery(requestOne, 1)) as Extract<
      Envelope,
      { type: "work.delivery" }
    >;
    state = await mustApply(state, requestOne);
    state = await mustApply(state, deliveryOne);
    state = await mustApply(state, await acceptance(deliveryOne, 2, "5"));

    const requestTwo = (await request("unit-002", 3)) as Extract<
      Envelope,
      { type: "work.request" }
    >;
    const deliveryTwo = (await delivery(requestTwo, 2)) as Extract<
      Envelope,
      { type: "work.delivery" }
    >;
    state = await mustApply(state, requestTwo);
    state = await mustApply(state, deliveryTwo);
    state = await mustApply(state, await acceptance(deliveryTwo, 4, "10"));

    const requestThree = (await request("unit-003", 5)) as Extract<
      Envelope,
      { type: "work.request" }
    >;
    const deliveryThree = (await delivery(requestThree, 3)) as Extract<
      Envelope,
      { type: "work.delivery" }
    >;
    state = await mustApply(state, requestThree);
    state = await mustApply(state, deliveryThree);
    state = await mustApply(state, await rejection(deliveryThree, 6));
    state = await mustApply(state, await close(7, "10"));

    expect(state).toMatchObject({
      acceptedUnits: 2,
      highestVoucherAmount: "10",
      rejectedUnits: 1,
      status: "closing",
    });

    const settlement = applyVerifiedSettlement(state, {
      amount: "10",
      chainId: 1952,
      channelId: state.config.channelId,
      confirmedAt: createdAt,
      status: "success",
      transactionHash: hashCanonical("settlement-001"),
    });
    expect(settlement).toMatchObject({
      event: { amount: "10", type: "settlement_confirmed" },
      ok: true,
      state: { status: "closed" },
    });
  });

  it("rejects replay without changing state", async () => {
    const envelope = await request("unit-001", 1);
    const state = await mustApply(createSessionState(config()), envelope);
    const beforeReplay = structuredClone(state);

    const result = await applyEnvelope(state, envelope);
    expectError(result, "replayed_message");
    expect(state).toEqual(beforeReplay);
  });

  it("rejects skipped and stale sequence numbers", async () => {
    const state = createSessionState(config());
    expectError(await applyEnvelope(state, await request("unit-001", 2)), "out_of_order");

    const applied = await mustApply(state, await request("unit-001", 1));
    expectError(
      await applyEnvelope(applied, await request("unit-002", 1, "request-unit-002")),
      "out_of_order",
    );
  });

  it("binds sender inboxes to their expected signer and role", async () => {
    const state = createSessionState(config());
    expectError(
      await applyEnvelope(state, await request("unit-001", 1, undefined, seller)),
      "unknown_sender",
    );

    const sellerRequest = await signEnvelope(
      {
        ...header("seller", "seller-request", 1),
        payload: { transactionHash: hashCanonical("tx"), workUnitId: "unit-001" },
        type: "work.request",
      },
      seller,
    );
    expectError(await applyEnvelope(state, sellerRequest), "role_not_allowed");
  });

  it("rejects duplicate work-unit IDs and mismatched delivery evidence", async () => {
    const requestEnvelope = (await request("unit-001", 1)) as Extract<
      Envelope,
      { type: "work.request" }
    >;
    const state = await mustApply(createSessionState(config()), requestEnvelope);
    expectError(
      await applyEnvelope(state, await request("unit-001", 2, "request-duplicate")),
      "work_unit_exists",
    );
    expectError(
      await applyEnvelope(
        state,
        await delivery(requestEnvelope, 1, { transactionHash: hashCanonical("wrong-transaction") }),
      ),
      "reference_mismatch",
    );
  });

  it("requires exactly one unit-price increase for acceptance", async () => {
    const { deliveryEnvelope, state } = await deliveredState();

    expectError(
      await applyEnvelope(state, await acceptance(deliveryEnvelope, 2, "4")),
      "voucher_amount_invalid",
    );
    expectError(
      await applyEnvelope(state, await acceptance(deliveryEnvelope, 2, "10")),
      "voucher_amount_invalid",
    );
  });

  it("enforces the funded cap", async () => {
    let state = createSessionState(config({ cap: "5" }));
    const requestOne = (await request("unit-001", 1)) as Extract<
      Envelope,
      { type: "work.request" }
    >;
    const deliveryOne = (await delivery(requestOne, 1)) as Extract<
      Envelope,
      { type: "work.delivery" }
    >;
    state = await mustApply(state, requestOne);
    state = await mustApply(state, deliveryOne);
    state = await mustApply(state, await acceptance(deliveryOne, 2, "5"));
    const requestTwo = (await request("unit-002", 3)) as Extract<
      Envelope,
      { type: "work.request" }
    >;
    const deliveryTwo = (await delivery(requestTwo, 2)) as Extract<
      Envelope,
      { type: "work.delivery" }
    >;
    state = await mustApply(state, requestTwo);
    state = await mustApply(state, deliveryTwo);

    expectError(await applyEnvelope(state, await acceptance(deliveryTwo, 4, "10")), "cap_exceeded");
  });

  it("never bills a rejected work unit", async () => {
    const { deliveryEnvelope, state: delivered } = await deliveredState();
    const rejected = await mustApply(delivered, await rejection(deliveryEnvelope, 2));

    expect(rejected.highestVoucherAmount).toBe("0");
    expect(rejected.rejectedUnits).toBe(1);
    expectError(
      await applyEnvelope(rejected, await acceptance(deliveryEnvelope, 3, "5")),
      "invalid_work_state",
    );
  });

  it("records a seller-signed work error as a terminal nonbillable result", async () => {
    const requestEnvelope = (await request("unit-001", 1)) as Extract<
      Envelope,
      { type: "work.request" }
    >;
    const requested = await mustApply(createSessionState(config()), requestEnvelope);
    const failed = await mustApply(requested, await workError(requestEnvelope, 1));

    expect(failed).toMatchObject({
      acceptedUnits: 0,
      highestVoucherAmount: "0",
      rejectedUnits: 0,
      workUnits: [
        {
          errorCode: "trial_capacity_reached",
          failureMessageId: "error-unit-001",
          status: "failed",
        },
      ],
    });
    expectError(
      await applyEnvelope(
        requested,
        await workError(requestEnvelope, 1, { requestMessageId: "different-request" }),
      ),
      "reference_mismatch",
    );
  });

  it("serializes race-shaped acceptances through sequence state", async () => {
    const { deliveryEnvelope, state } = await deliveredState();
    const first = await acceptance(deliveryEnvelope, 2, "5", "accept-race-a");
    const second = await acceptance(deliveryEnvelope, 2, "5", "accept-race-b");
    const committed = await mustApply(state, first);

    expectError(await applyEnvelope(committed, second), "out_of_order");
  });

  it("requires close and settlement amounts to match verified vouchers", async () => {
    const { deliveryEnvelope, state: delivered } = await deliveredState();
    const accepted = await mustApply(delivered, await acceptance(deliveryEnvelope, 2, "5"));

    expectError(await applyEnvelope(accepted, await close(3, "0")), "final_amount_mismatch");
    expectError(
      applyVerifiedSettlement(accepted, {
        amount: "5",
        chainId: 1952,
        channelId: accepted.config.channelId,
        confirmedAt: createdAt,
        status: "success",
        transactionHash: hashCanonical("settlement"),
      }),
      "session_not_closing",
    );

    const closing = await mustApply(accepted, await close(3, "5"));
    expectError(
      applyVerifiedSettlement(closing, {
        amount: "4",
        chainId: 1952,
        channelId: closing.config.channelId,
        confirmedAt: createdAt,
        status: "success",
        transactionHash: hashCanonical("settlement"),
      }),
      "final_amount_mismatch",
    );
    expectError(
      applyVerifiedSettlement(closing, { status: "success" }),
      "invalid_settlement_receipt",
    );
  });

  it("blocks new work after close and rejects corrupted stored state", async () => {
    const closing = await mustApply(createSessionState(config()), await close(1, "0"));
    expectError(await applyEnvelope(closing, await request("unit-001", 2)), "session_not_open");

    const corrupted = { ...closing, highestVoucherAmount: "5" };
    expectError(
      await applyEnvelope(corrupted, await request("unit-001", 2)),
      "invalid_session_state",
    );

    const unknownSequence = {
      ...createSessionState(config()),
      lastSequences: [{ inboxId: "unknown-inbox", sequence: 1 }],
    };
    expectError(
      await applyEnvelope(unknownSequence, await request("unit-001", 1)),
      "invalid_session_state",
    );

    const requested = await mustApply(createSessionState(config()), await request("unit-001", 1));
    const ghostMessage = {
      ...requested,
      processedMessageIds: [...requested.processedMessageIds, "ghost-message"],
    };
    expectError(
      await applyEnvelope(ghostMessage, await request("unit-002", 2)),
      "invalid_session_state",
    );
  });

  it("rejects malformed envelopes without mutating state", async () => {
    const state = createSessionState(config());
    const snapshot = structuredClone(state);
    const result = await applyEnvelope(state, { type: "work.request" });

    expectError(result, "invalid_envelope");
    expect(state).toEqual(snapshot);
  });

  it("rejects an envelope for another session", async () => {
    const state = createSessionState(config());
    const foreignEnvelope = await signEnvelope(
      {
        ...header("buyer", "foreign-request", 1),
        payload: { transactionHash: hashCanonical("tx"), workUnitId: "unit-001" },
        sessionId: "session-foreign",
        type: "work.request",
      },
      buyer,
    );
    expectError(await applyEnvelope(state, foreignEnvelope), "wrong_session");
  });

  it("validates session economics and party separation", () => {
    expect(() => createSessionState(config({ cap: "4" }))).toThrow();
    expect(() =>
      createSessionState(config({ seller: { address: buyer.address, inboxId: buyerInboxId } })),
    ).toThrow();
  });
});
