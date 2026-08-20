export type CaptureKind = "local-protocol-verification";
export type NetworkMode = "offline";
export type EvidenceStatus = "verified" | "pending" | "blocked";
export type MessageActor = "buyer" | "agent";

export interface CapturedMessage {
  actor: MessageActor;
  body: string;
  id: string;
  label: string;
  occurredAt: string;
  status: "verified";
}

export interface EvidenceRecord {
  detail: string;
  id: string;
  label: string;
  protocol: string;
  status: "verified";
}

export interface CapturedSession {
  capture: {
    capturedAt: string;
    fundsMoved: false;
    kind: CaptureKind;
    networkMode: NetworkMode;
  };
  evidence: EvidenceRecord[];
  messages: CapturedMessage[];
  result: {
    checks: { label: string; result: string }[];
    fixtureTransactionHash: string;
    note: string;
  };
  session: {
    asset: "USDT0";
    capAtomic: string;
    chainId: 1952;
    id: string;
    title: string;
    unitPriceAtomic: string;
  };
}

export type EvidenceRequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { data: CapturedSession; status: "success" }
  | { message: string; status: "error" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseCapturedSession(value: unknown): CapturedSession {
  if (!isRecord(value) || !isRecord(value.capture) || !isRecord(value.session)) {
    throw new Error("Captured evidence has an invalid root shape.");
  }

  if (
    value.capture.kind !== "local-protocol-verification" ||
    value.capture.networkMode !== "offline" ||
    value.capture.fundsMoved !== false
  ) {
    throw new Error("Captured evidence has invalid provenance.");
  }

  if (
    value.session.chainId !== 1952 ||
    value.session.asset !== "USDT0" ||
    typeof value.session.id !== "string" ||
    typeof value.session.title !== "string" ||
    typeof value.session.capAtomic !== "string" ||
    typeof value.session.unitPriceAtomic !== "string"
  ) {
    throw new Error("Captured evidence has invalid session data.");
  }

  if (!Array.isArray(value.messages) || !Array.isArray(value.evidence) || !isRecord(value.result)) {
    throw new Error("Captured evidence is missing protocol records.");
  }

  return value as unknown as CapturedSession;
}

export function formatAtomicAmount(value: string): string {
  const atomic = BigInt(value);
  const whole = atomic / 1_000_000n;
  const fraction = (atomic % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction.length > 0 ? `${String(whole)}.${fraction}` : String(whole);
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
