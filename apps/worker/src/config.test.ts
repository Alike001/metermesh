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
      access: { allowedBuyerAddress: buyerAddress, mode: "allowlist" },
      healthPort: 3000,
      healthStaleMs: 30_000,
      pollIntervalMs: 750,
      workerId: "worker-test",
    });
  });

  it("parses a bounded public trial without requiring an allowlisted buyer", () => {
    expect(
      getMeterMeshWorkerConfig({
        DATABASE_URL: "postgres://localhost/metermesh",
        METERMESH_ALLOW_UNFUNDED_XMTP_WORK: "1",
        METERMESH_TRIAL_GLOBAL_LIMIT: "25",
        METERMESH_WORKER_HEALTH_STALE_MS: "45000",
        METERMESH_XMTP_ACCESS_MODE: "public-trial",
        PORT: "4000",
      }),
    ).toMatchObject({
      access: { globalLimit: 25, mode: "public-trial" },
      healthPort: 4000,
      healthStaleMs: 45_000,
    });
    expect(() =>
      getMeterMeshWorkerConfig({
        DATABASE_URL: "postgres://localhost/metermesh",
        METERMESH_ALLOW_UNFUNDED_XMTP_WORK: "1",
        METERMESH_TRIAL_GLOBAL_LIMIT: "0",
        METERMESH_XMTP_ACCESS_MODE: "public-trial",
      }),
    ).toThrow("METERMESH_TRIAL_GLOBAL_LIMIT");
  });
});
