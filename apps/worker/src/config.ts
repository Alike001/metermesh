import { getAddress, isAddress, type Address } from "viem";

export class WorkerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerConfigError";
  }
}

export interface MeterMeshWorkerConfig {
  allowedBuyerAddress: Address;
  databaseUrl: string;
  pollIntervalMs: number;
  workerId: string;
}

function requireValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new WorkerConfigError(`${name} is required.`);
  return value;
}

function parsePollInterval(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 2_000;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 500 || parsed > 60_000) {
    throw new WorkerConfigError("METERMESH_WORKER_POLL_MS must be between 500 and 60000.");
  }
  return parsed;
}

function optionalValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function getMeterMeshWorkerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): MeterMeshWorkerConfig {
  if (environment.METERMESH_ALLOW_UNFUNDED_XMTP_WORK !== "1") {
    throw new WorkerConfigError(
      "METERMESH_ALLOW_UNFUNDED_XMTP_WORK must be 1 for the explicit nonbillable transport verifier.",
    );
  }
  const address = requireValue(environment, "XMTP_ALLOWED_BUYER_ADDRESS");
  if (!isAddress(address)) {
    throw new WorkerConfigError("XMTP_ALLOWED_BUYER_ADDRESS must be a valid EVM address.");
  }
  return {
    allowedBuyerAddress: getAddress(address),
    databaseUrl: requireValue(environment, "DATABASE_URL"),
    pollIntervalMs: parsePollInterval(environment.METERMESH_WORKER_POLL_MS),
    workerId: optionalValue(environment.METERMESH_WORKER_ID) ?? `worker-${process.pid.toString()}`,
  };
}
