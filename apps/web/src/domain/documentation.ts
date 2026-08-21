export const DOCUMENTATION_ARTIFACTS = [
  "/.well-known/metermesh.json",
  "/openapi.json",
  "/llms.txt",
] as const;

export const COPYABLE_REQUEST_EXAMPLE = {
  protocol: "metermesh",
  version: 1,
  type: "work.request",
  sessionId: "session-example-001",
  messageId: "request-example-001",
  senderInboxId: "buyer-example-inbox",
  sequence: 1,
  createdAt: "2026-08-20T10:00:00.000Z",
  payload: {
    transactionHash: "0xf0bbcf38db1ee7935111b2be46fd1062d097e0461b2f48f34b9a5ba17482fafd",
    workUnitId: "work-example-001",
  },
} as const;

const capabilityStates = ["verified", "unavailable", "gated"] as const;
export type CapabilityState = (typeof capabilityStates)[number];

export interface CapabilityStatus {
  id: string;
  label: string;
  note: string;
  state: CapabilityState;
}

export interface MeterMeshManifest {
  capabilityStatus: CapabilityStatus[];
  name: "MeterMesh";
  schemaVersion: "1.0";
  version: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
) {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new Error(`${path} contains unexpected or missing fields.`);
  }
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value;
}

function requireRecord(
  value: unknown,
  expected: readonly string[],
  path: string,
): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} must be an object.`);
  assertExactKeys(value, expected, path);
  return value;
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value.map((item, index) => requireString(item, `${path}[${String(index)}]`));
}

function parseCapabilityStatus(value: unknown, index: number): CapabilityStatus {
  if (!isRecord(value)) throw new Error(`capabilityStatus[${String(index)}] must be an object.`);
  assertExactKeys(value, ["id", "label", "note", "state"], `capabilityStatus[${String(index)}]`);
  const state = requireString(value.state, `capabilityStatus[${String(index)}].state`);
  if (!capabilityStates.includes(state as CapabilityState)) {
    throw new Error(`capabilityStatus[${String(index)}].state is unsupported.`);
  }
  return {
    id: requireString(value.id, `capabilityStatus[${String(index)}].id`),
    label: requireString(value.label, `capabilityStatus[${String(index)}].label`),
    note: requireString(value.note, `capabilityStatus[${String(index)}].note`),
    state: state as CapabilityState,
  };
}

export function parseMeterMeshManifest(value: unknown): MeterMeshManifest {
  if (!isRecord(value)) throw new Error("The service manifest must be an object.");
  assertExactKeys(
    value,
    [
      "authentication",
      "billing",
      "capability",
      "capabilityStatus",
      "examples",
      "knownLimitations",
      "links",
      "name",
      "network",
      "schemaVersion",
      "version",
    ],
    "manifest",
  );
  if (value.name !== "MeterMesh" || value.schemaVersion !== "1.0") {
    throw new Error("The service manifest identity or schema version is invalid.");
  }
  if (!Array.isArray(value.capabilityStatus) || value.capabilityStatus.length === 0) {
    throw new Error("The service manifest needs at least one capability status.");
  }

  const capability = requireRecord(
    value.capability,
    ["id", "input", "output", "summary", "transport"],
    "capability",
  );
  ["id", "input", "output", "summary", "transport"].forEach((key) =>
    requireString(capability[key], `capability.${key}`),
  );

  const network = requireRecord(
    value.network,
    ["chainId", "mppEscrowAddress", "name", "nativeCurrency", "paymentToken"],
    "network",
  );
  if (network.chainId !== 1952) throw new Error("network.chainId must be 1952.");
  ["mppEscrowAddress", "name", "nativeCurrency"].forEach((key) =>
    requireString(network[key], `network.${key}`),
  );
  const paymentToken = requireRecord(network.paymentToken, ["address", "symbol"], "paymentToken");
  requireString(paymentToken.address, "paymentToken.address");
  requireString(paymentToken.symbol, "paymentToken.symbol");

  const billing = requireRecord(
    value.billing,
    ["authorization", "basis", "rule", "settlement"],
    "billing",
  );
  ["authorization", "basis", "rule", "settlement"].forEach((key) =>
    requireString(billing[key], `billing.${key}`),
  );

  const authentication = requireRecord(
    value.authentication,
    ["execution", "permissions", "publicDocs"],
    "authentication",
  );
  requireString(authentication.execution, "authentication.execution");
  requireString(authentication.publicDocs, "authentication.publicDocs");
  requireStringArray(authentication.permissions, "authentication.permissions");

  const examples = requireRecord(value.examples, ["explanation", "request"], "examples");
  if (!isRecord(examples.explanation) || !isRecord(examples.request)) {
    throw new Error("Manifest examples must be objects.");
  }

  const links = requireRecord(
    value.links,
    [
      "anchoredEvidence",
      "capturedEvidence",
      "documentation",
      "explanationSchema",
      "llms",
      "openapi",
      "protocolSchema",
      "revertedEvidence",
      "source",
    ],
    "links",
  );
  Object.keys(links).forEach((key) => requireString(links[key], `links.${key}`));
  requireStringArray(value.knownLimitations, "knownLimitations");

  return {
    capabilityStatus: value.capabilityStatus.map(parseCapabilityStatus),
    name: value.name,
    schemaVersion: value.schemaVersion,
    version: requireString(value.version, "version"),
  };
}

function readUnknownJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

export async function loadDocumentationArtifacts(
  request: typeof fetch = fetch,
): Promise<MeterMeshManifest> {
  const [manifestResponse, openApiResponse] = await Promise.all([
    request(DOCUMENTATION_ARTIFACTS[0]),
    request(DOCUMENTATION_ARTIFACTS[1]),
  ]);
  if (!manifestResponse.ok || !openApiResponse.ok) {
    throw new Error("Machine discovery is unavailable. The integration guide remains readable.");
  }
  const [manifest, openApi] = await Promise.all([
    readUnknownJson(manifestResponse),
    readUnknownJson(openApiResponse),
  ]);
  if (!isRecord(openApi) || openApi.openapi !== "3.1.0" || !isRecord(openApi.paths)) {
    throw new Error("The published OpenAPI document is malformed.");
  }
  return parseMeterMeshManifest(manifest);
}
