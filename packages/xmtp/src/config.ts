import { resolve } from "node:path";

import type { XmtpEnv } from "@xmtp/node-sdk";
import type { Hex } from "viem";

const privateKeyPattern = /^0x[0-9a-fA-F]{64}$/u;
const supportedEnvironments = new Set<XmtpEnv>(["local", "dev", "production"]);

export class XmtpConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmtpConfigError";
  }
}

export interface MeterMeshXmtpConfig {
  appVersion: string;
  dbEncryptionKey: Hex;
  dbPath: string;
  env: XmtpEnv;
  walletKey: Hex;
}

function requirePrivateKey(value: string | undefined, name: string): Hex {
  const normalized = value?.trim();
  if (normalized === undefined || !privateKeyPattern.test(normalized)) {
    throw new XmtpConfigError(`${name} must be a 32-byte 0x-prefixed hexadecimal value.`);
  }
  return normalized.toLowerCase() as Hex;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function getMeterMeshXmtpConfig(
  environment: NodeJS.ProcessEnv = process.env,
): MeterMeshXmtpConfig {
  const requestedEnvironment = nonEmpty(environment.XMTP_ENV) ?? "dev";
  if (!supportedEnvironments.has(requestedEnvironment as XmtpEnv)) {
    throw new XmtpConfigError("XMTP_ENV must be local, dev, or production.");
  }

  const appVersion = nonEmpty(environment.XMTP_APP_VERSION) ?? "metermesh-agent/0.1.0";
  if (!/^[A-Za-z0-9._/-]{3,80}$/u.test(appVersion)) {
    throw new XmtpConfigError("XMTP_APP_VERSION contains unsupported characters.");
  }

  const configuredPath = nonEmpty(environment.XMTP_DB_PATH);
  const dbPath = resolve(configuredPath ?? ".xmtp/metermesh-seller.db3");

  return {
    appVersion,
    dbEncryptionKey: requirePrivateKey(
      environment.XMTP_DB_ENCRYPTION_KEY,
      "XMTP_DB_ENCRYPTION_KEY",
    ),
    dbPath,
    env: requestedEnvironment as XmtpEnv,
    walletKey: requirePrivateKey(environment.XMTP_WALLET_KEY, "XMTP_WALLET_KEY"),
  };
}
