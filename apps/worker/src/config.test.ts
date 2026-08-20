import { describe, expect, it } from "vitest";

import { getMeterMeshWorkerConfig, WorkerConfigError } from "./config.js";

const buyerAddress = "0x1111111111111111111111111111111111111111";

describe("MeterMesh worker configuration", () => {
  it("requires an explicit nonbillable gate, database, and allowlisted buyer", () => {
    expect(() => getMeterMeshWorkerConfig({})).toThrow(WorkerConfigError);
    expect(() =>
      getMeterMeshWorkerConfig({
        DATABASE_URL: "postgres://localhost/metermesh",
        METERMESH_ALLOW_UNFUNDED_XMTP_WORK: "1",
        XMTP_ALLOWED_BUYER_ADDRESS: "invalid",
      }),
    ).toThrow("valid EVM address");
  });

  it("parses the bounded poll interval without exposing credentials", () => {
    expect(
      getMeterMeshWorkerConfig({
        DATABASE_URL: "postgres://localhost/metermesh",
        METERMESH_ALLOW_UNFUNDED_XMTP_WORK: "1",
        METERMESH_WORKER_ID: "worker-test",
        METERMESH_WORKER_POLL_MS: "750",
        XMTP_ALLOWED_BUYER_ADDRESS: buyerAddress,
      }),
    ).toMatchObject({
      allowedBuyerAddress: buyerAddress,
      pollIntervalMs: 750,
      workerId: "worker-test",
    });
  });
});
