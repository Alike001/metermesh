import { createMeterMeshIdentity } from "@metermesh/xmtp";
import { signEnvelope, type Envelope } from "@metermesh/protocol";
import { describe, expect, it, vi } from "vitest";

import { createRequestAuthorizer } from "./access.js";

const buyer = createMeterMeshIdentity(`0x${"11".repeat(32)}`);

async function request(): Promise<Extract<Envelope, { type: "work.request" }>> {
  const envelope = await signEnvelope(
    {
      createdAt: "2026-08-20T12:00:00.000Z",
      messageId: "trial-request-001",
      payload: {
        transactionHash: `0x${"22".repeat(32)}`,
        workUnitId: "trial-work-001",
      },
      protocol: "metermesh",
      senderInboxId: "trial-buyer-inbox",
      sequence: 1,
      sessionId: "trial-session-001",
      type: "work.request",
      version: 1,
    },
    buyer.envelopeSigner,
  );
  if (envelope.type !== "work.request") throw new Error("Expected request envelope.");
  return envelope;
}

describe("worker request access", () => {
  const context = {
    carrierMessageId: "carrier-trial-001",
    sentAt: new Date("2026-08-20T12:00:01.000Z"),
  };

  it("keeps allowlist mode fail closed", async () => {
    const trialStore = { reservePublicTrial: vi.fn() };
    const allowed = createRequestAuthorizer(
      { allowedBuyerAddress: buyer.envelopeSigner.address, mode: "allowlist" },
      trialStore,
    );
    await expect(allowed(await request(), context)).resolves.toEqual({ ok: true });
    expect(trialStore.reservePublicTrial).not.toHaveBeenCalled();
  });

  it("maps persistent public-trial decisions to safe signed-error codes", async () => {
    const reservePublicTrial = vi
      .fn()
      .mockResolvedValueOnce({ globalLimit: 50, status: "before_activation", usedCount: 0 })
      .mockResolvedValueOnce({ globalLimit: 50, status: "reserved", usedCount: 1 })
      .mockResolvedValueOnce({ globalLimit: 50, status: "wallet_used", usedCount: 1 })
      .mockResolvedValueOnce({ globalLimit: 50, status: "request_collision", usedCount: 1 })
      .mockResolvedValueOnce({ globalLimit: 50, status: "capacity_reached", usedCount: 50 });
    const authorize = createRequestAuthorizer(
      { globalLimit: 50, mode: "public-trial" },
      { reservePublicTrial },
    );
    const envelope = await request();

    await expect(authorize(envelope, context)).resolves.toEqual({
      detail: "The request predates public-trial activation.",
      ok: false,
      silent: true,
    });
    await expect(authorize(envelope, context)).resolves.toEqual({ ok: true });
    await expect(authorize(envelope, context)).resolves.toMatchObject({
      code: "trial_wallet_used",
      ok: false,
    });
    await expect(authorize(envelope, context)).resolves.toMatchObject({
      code: "request_denied",
      ok: false,
    });
    await expect(authorize(envelope, context)).resolves.toMatchObject({
      code: "trial_capacity_reached",
      ok: false,
    });
    expect(reservePublicTrial).toHaveBeenCalledWith(
      expect.objectContaining({ receivedAt: context.sentAt }),
    );
  });
});
