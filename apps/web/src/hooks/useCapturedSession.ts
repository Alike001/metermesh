import { useCallback, useEffect, useState } from "react";

import { parseCapturedSession, type EvidenceRequestState } from "../domain/session";

export function useCapturedSession(enabled: boolean) {
  const [requestState, setRequestState] = useState<EvidenceRequestState>({ status: "idle" });
  const [requestVersion, setRequestVersion] = useState(0);

  const reload = useCallback(() => {
    setRequestVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setRequestState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setRequestState({ status: "loading" });

    void fetch("/evidence/captured-session.json", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Evidence request failed with HTTP ${String(response.status)}.`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        setRequestState({ data: parseCapturedSession(value), status: "success" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Evidence could not be loaded.";
        setRequestState({ message, status: "error" });
      });

    return () => {
      controller.abort();
    };
  }, [enabled, requestVersion]);

  return { reload, requestState };
}
