import { explainTransaction } from "@metermesh/ai";
import { fetchTransactionFacts } from "@metermesh/chain";
import { MeterMeshDatabase } from "@metermesh/db";
import { getMeterMeshXmtpConfig, NodeXmtpCarrier, XmtpRetryExhaustedError } from "@metermesh/xmtp";

import { getMeterMeshWorkerConfig } from "./config.js";
import { createRequestAuthorizer } from "./access.js";
import { closeHealthServer, startHealthServer, WorkerHealth } from "./health.js";
import { MeterMeshTransportWorker } from "./orchestrator.js";

function delay(durationMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(finish, durationMs);
    function finish(): void {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}

async function main(): Promise<void> {
  const workerConfig = getMeterMeshWorkerConfig();
  const xmtpConfig = getMeterMeshXmtpConfig();
  const health = new WorkerHealth(workerConfig.healthStaleMs);
  const healthServer = await startHealthServer(workerConfig.healthPort, health);
  const database = MeterMeshDatabase.connect(workerConfig.databaseUrl);
  const shutdown = new AbortController();
  const stop = () => {
    shutdown.abort();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  let carrier: NodeXmtpCarrier | null = null;
  try {
    await database.migrate();
    await database.checkHealth();
    if (workerConfig.access.mode === "public-trial") {
      await database.ensurePublicTrialBudget(workerConfig.access.globalLimit);
    }
    carrier = await NodeXmtpCarrier.connect(xmtpConfig);
    process.stdout.write(`[worker] XMTP client connected inbox=${carrier.inboxId}\n`);
    const worker = new MeterMeshTransportWorker({
      authorizeRequest: createRequestAuthorizer(workerConfig.access, database),
      carrier,
      explain: async (transactionHash) =>
        explainTransaction(await fetchTransactionFacts(transactionHash)),
      outbox: database,
      sellerWalletKey: xmtpConfig.walletKey,
      workerId: workerConfig.workerId,
    });
    process.stdout.write("[worker] entering poll loop\n");
    while (!shutdown.signal.aborted) {
      try {
        const ingestResult = await worker.ingest();
        const processResult = await worker.processAvailable();
        if (
          ingestResult.queued > 0 ||
          ingestResult.rejected > 0 ||
          processResult.completed > 0 ||
          processResult.failed > 0
        ) {
          process.stdout.write(
            `[worker] cycle queued=${String(ingestResult.queued)} rejected=${String(ingestResult.rejected)} completed=${String(processResult.completed)} failed=${String(processResult.failed)}\n`,
          );
        }
        await database.checkHealth();
        health.markCycleSucceeded();
        await delay(workerConfig.pollIntervalMs, shutdown.signal);
      } catch (error) {
        if (!(error instanceof XmtpRetryExhaustedError)) throw error;
        process.stderr.write(
          `[worker] XMTP temporarily unavailable after ${String(error.attempts)} attempts. Health remains stale until the next successful cycle. ${error.cause instanceof Error ? error.cause.message : ""}\n`,
        );
        await delay(Math.max(workerConfig.pollIntervalMs, 5_000), shutdown.signal);
      }
    }
  } finally {
    health.markStopped();
    await Promise.allSettled([
      ...(carrier === null ? [] : [carrier.close()]),
      database.close(),
      closeHealthServer(healthServer),
    ]);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "MeterMesh worker failed."}\n`);
  process.exitCode = 1;
});
