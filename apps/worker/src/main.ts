import { explainTransaction } from "@metermesh/ai";
import { fetchTransactionFacts } from "@metermesh/chain";
import { MeterMeshDatabase } from "@metermesh/db";
import { getMeterMeshXmtpConfig, NodeXmtpCarrier } from "@metermesh/xmtp";

import { getMeterMeshWorkerConfig } from "./config.js";
import { MeterMeshTransportWorker } from "./orchestrator.js";

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function main(): Promise<void> {
  const workerConfig = getMeterMeshWorkerConfig();
  const xmtpConfig = getMeterMeshXmtpConfig();
  const database = MeterMeshDatabase.connect(workerConfig.databaseUrl);
  await database.migrate();
  const carrier = await NodeXmtpCarrier.connect(xmtpConfig);
  const worker = new MeterMeshTransportWorker({
    allowedBuyerAddress: workerConfig.allowedBuyerAddress,
    carrier,
    explain: async (transactionHash) =>
      explainTransaction(await fetchTransactionFacts(transactionHash)),
    outbox: database,
    sellerWalletKey: xmtpConfig.walletKey,
    workerId: workerConfig.workerId,
  });

  const shutdown = new AbortController();
  const stop = () => {
    shutdown.abort();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    while (!shutdown.signal.aborted) {
      await worker.ingest();
      await worker.processAvailable();
      await delay(workerConfig.pollIntervalMs);
    }
  } finally {
    await Promise.allSettled([carrier.close(), database.close()]);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "MeterMesh worker failed."}\n`);
  process.exitCode = 1;
});
