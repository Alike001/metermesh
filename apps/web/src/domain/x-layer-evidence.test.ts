import { describe, expect, it } from "vitest";

import deployment from "../../../../contracts/deployments/xlayer-testnet.json";
import anchoredProof from "../../public/evidence/anchored-live-proof.json";
import revertedEvidence from "../../public/evidence/reverted-live-proof.json";
import { verifyLiveEvidenceBundle } from "./live-evidence";
import {
  ANCHORED_LIVE_EVIDENCE,
  REVERTED_LIVE_EVIDENCE,
  X_LAYER_TESTNET_EXPLORER,
  xLayerTestnetTransactionUrl,
} from "./x-layer-evidence";

describe("public X Layer evidence", () => {
  it("publishes the exact signed proof committed by the deployed anchor", async () => {
    const verification = await verifyLiveEvidenceBundle(anchoredProof);

    expect(verification).toMatchObject({ ok: true });
    expect(anchoredProof.anchorEvidenceHash).toBe(ANCHORED_LIVE_EVIDENCE.anchorEvidenceHash);
    expect(anchoredProof.result.transactionHash).toBe(ANCHORED_LIVE_EVIDENCE.sourceTransactionHash);
    expect(anchoredProof.fundsMoved).toBe(false);
    expect(anchoredProof.voucherSigned).toBe(false);
    expect(deployment.anchorWrite).toMatchObject({
      evidenceHash: ANCHORED_LIVE_EVIDENCE.anchorEvidenceHash,
      sourceTransactionHash: ANCHORED_LIVE_EVIDENCE.sourceTransactionHash,
      transaction: ANCHORED_LIVE_EVIDENCE.anchorTransactionHash,
    });
    expect(deployment.address).toBe(ANCHORED_LIVE_EVIDENCE.contractAddress);
  });

  it("builds only complete official Testnet explorer links", () => {
    expect(xLayerTestnetTransactionUrl(ANCHORED_LIVE_EVIDENCE.anchorTransactionHash)).toBe(
      `${X_LAYER_TESTNET_EXPLORER}/tx/${ANCHORED_LIVE_EVIDENCE.anchorTransactionHash}`,
    );
    expect(() => xLayerTestnetTransactionUrl("0x1234")).toThrow("complete transaction hash");
  });

  it("publishes a signed XMTP proof for a real reverted receipt", async () => {
    await expect(verifyLiveEvidenceBundle(revertedEvidence)).resolves.toMatchObject({ ok: true });
    expect(revertedEvidence.result.transactionHash).toBe(REVERTED_LIVE_EVIDENCE.transactionHash);
    expect(revertedEvidence.result.status).toBe("reverted");
    expect(revertedEvidence.result.failureReason).toBeNull();
    expect(revertedEvidence.result.limitations).toContain(
      "The receipt reports a revert, but the RPC facts do not include a verified revert reason.",
    );
    expect(revertedEvidence.verification).toMatchObject({
      buyerEnvelope: "verified",
      resultBinding: "verified",
      sellerEnvelope: "verified",
      sellerInboxAuthorization: "observed-online-at-receipt",
    });
    expect(revertedEvidence.fundsMoved).toBe(false);
    expect(revertedEvidence.voucherSigned).toBe(false);
  });
});
