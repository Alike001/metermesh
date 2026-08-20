import type { MeterMeshDatabase } from "@metermesh/db";
import { hashCanonical } from "@metermesh/protocol";

import type { WorkerAccessConfig } from "./config.js";
import type { WorkerRequestAuthorizer } from "./orchestrator.js";

type TrialStore = Pick<MeterMeshDatabase, "reservePublicTrial">;

export function createRequestAuthorizer(
  access: WorkerAccessConfig,
  trialStore: TrialStore,
): WorkerRequestAuthorizer {
  if (access.mode === "allowlist") {
    return (request) =>
      Promise.resolve(
        request.signature.signer.toLowerCase() === access.allowedBuyerAddress.toLowerCase()
          ? { ok: true }
          : {
              code: "request_denied",
              detail: "This verification worker is restricted to its configured buyer wallet.",
              ok: false,
              retryable: false,
              silent: false,
            },
      );
  }

  return async (request, context) => {
    const reservation = await trialStore.reservePublicTrial({
      globalLimit: access.globalLimit,
      receivedAt: context.sentAt,
      requestHash: hashCanonical(request),
      requestMessageId: request.messageId,
      signerAddress: request.signature.signer,
      transactionHash: request.payload.transactionHash,
    });
    if (reservation.status === "reserved" || reservation.status === "duplicate") {
      return { ok: true };
    }
    if (reservation.status === "before_activation") {
      return {
        detail: "The request predates public-trial activation.",
        ok: false,
        silent: true,
      };
    }
    if (reservation.status === "wallet_used") {
      return {
        code: "trial_wallet_used",
        detail: "This wallet has already used its one public verification request.",
        ok: false,
        retryable: false,
        silent: false,
      };
    }
    if (reservation.status === "request_collision") {
      return {
        code: "request_denied",
        detail: "This request message ID is already bound to different signed content.",
        ok: false,
        retryable: false,
        silent: false,
      };
    }
    return {
      code: "trial_capacity_reached",
      detail: "The bounded public verification capacity has been reached.",
      ok: false,
      retryable: false,
      silent: false,
    };
  };
}
