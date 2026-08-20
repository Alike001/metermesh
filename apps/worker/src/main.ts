import { explainTransaction } from "@metermesh/ai";
import { fetchTransactionFacts } from "@metermesh/chain";
import { MeterMeshDatabase } from "@metermesh/db";
import { getMeterMeshXmtpConfig, NodeXmtpCarrier } from "@metermesh/xmtp";

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
    const worker = new MeterMeshTransportWorker({
      authorizeRequest: createRequestAuthorizer(workerConfig.access, database),
      carrier,
      explain: async (transactionHash) =>
        explainTransaction(await fetchTransactionFacts(transactionHash)),
      outbox: database,
      sellerWalletKey: xmtpConfig.walletKey,
      workerId: workerConfig.workerId,
    });
    while (!shutdown.signal.aborted) {
      await worker.ingest();
      await worker.processAvailable();
      await database.checkHealth();
      health.markCycleSucceeded();
      await delay(workerConfig.pollIntervalMs, shutdown.signal);
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
