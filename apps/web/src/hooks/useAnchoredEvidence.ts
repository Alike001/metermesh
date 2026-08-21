import { useCallback, useEffect, useState } from "react";

import { verifyLiveEvidenceBundle, type LiveEvidenceBundle } from "../domain/live-evidence";
import { ANCHORED_LIVE_EVIDENCE } from "../domain/x-layer-evidence";

export type AnchoredEvidenceState =
  | { status: "loading" }
  | { bundle: LiveEvidenceBundle; status: "success" }
  | { message: string; status: "error" };

export function useAnchoredEvidence() {
  const [state, setState] = useState<AnchoredEvidenceState>({ status: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);

  const reload = useCallback(() => {
    setRequestVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    void fetch(ANCHORED_LIVE_EVIDENCE.proofPath, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Signed proof request failed with HTTP ${String(response.status)}.`);
        }
        return response.json() as Promise<unknown>;
      })
      .then(async (value) => {
        const verification = await verifyLiveEvidenceBundle(value);
        if (!verification.ok) throw new Error(verification.detail);
        if (verification.bundle.anchorEvidenceHash !== ANCHORED_LIVE_EVIDENCE.anchorEvidenceHash) {
          throw new Error("The signed proof does not match the published X Layer anchor.");
        }
        setState({ bundle: verification.bundle, status: "success" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Signed proof could not be loaded.";
        setState({ message, status: "error" });
      });

    return () => {
      controller.abort();
    };
  }, [requestVersion]);

  return { reload, state };
}
