import { getAddress, isAddress, type Address } from "viem";

export class WorkerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerConfigError";
  }
}

export type WorkerAccessConfig =
  | { allowedBuyerAddress: Address; mode: "allowlist" }
  | { globalLimit: number; mode: "public-trial" };

export interface MeterMeshWorkerConfig {
  access: WorkerAccessConfig;
  databaseUrl: string;
  healthPort: number;
  healthStaleMs: number;
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

function parseInteger(
  value: string | undefined,
  options: { defaultValue: number; maximum: number; minimum: number; name: string },
): number {
  if (value === undefined || value.trim() === "") return options.defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < options.minimum || parsed > options.maximum) {
    throw new WorkerConfigError(
      `${options.name} must be between ${String(options.minimum)} and ${String(options.maximum)}.`,
    );
  }
  return parsed;
}

function parseAccess(environment: NodeJS.ProcessEnv): WorkerAccessConfig {
  const mode = optionalValue(environment.METERMESH_XMTP_ACCESS_MODE) ?? "allowlist";
  if (mode === "public-trial") {
    return {
      globalLimit: parseInteger(environment.METERMESH_TRIAL_GLOBAL_LIMIT, {
        defaultValue: 50,
        maximum: 1000,
        minimum: 1,
        name: "METERMESH_TRIAL_GLOBAL_LIMIT",
      }),
      mode,
    };
  }
  if (mode !== "allowlist") {
    throw new WorkerConfigError("METERMESH_XMTP_ACCESS_MODE must be allowlist or public-trial.");
  }
  const address = requireValue(environment, "XMTP_ALLOWED_BUYER_ADDRESS");
  if (!isAddress(address)) {
    throw new WorkerConfigError("XMTP_ALLOWED_BUYER_ADDRESS must be a valid EVM address.");
  }
  return { allowedBuyerAddress: getAddress(address), mode };
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
  return {
    access: parseAccess(environment),
    databaseUrl: requireValue(environment, "DATABASE_URL"),
    healthPort: parseInteger(environment.PORT, {
      defaultValue: 3000,
      maximum: 65_535,
      minimum: 1,
      name: "PORT",
    }),
    healthStaleMs: parseInteger(environment.METERMESH_WORKER_HEALTH_STALE_MS, {
      defaultValue: 30_000,
      maximum: 300_000,
      minimum: 5_000,
      name: "METERMESH_WORKER_HEALTH_STALE_MS",
    }),
    pollIntervalMs: parsePollInterval(environment.METERMESH_WORKER_POLL_MS),
    workerId: optionalValue(environment.METERMESH_WORKER_ID) ?? `worker-${process.pid.toString()}`,
  };
}
