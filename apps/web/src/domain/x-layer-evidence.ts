export const X_LAYER_TESTNET_EXPLORER = "https://web3.okx.com/explorer/x-layer-testnet";

export const ANCHORED_LIVE_EVIDENCE = {
  anchorEvidenceHash: "0x9a40e300b85f3e055b7e181bca644f35575bf0c10d3ab3e591b76e69fd830e33",
  anchorTransactionHash: "0xf518187f13559ab46cfa1c85d64089a8c99eca8d1ee9d77a41840046f0e7aa5a",
  contractAddress: "0xE9827c90f742C593F966B7E878e2a13fdC8f1683",
  proofPath: "/evidence/anchored-live-proof.json",
  sourceTransactionHash: "0xf0bbcf38db1ee7935111b2be46fd1062d097e0461b2f48f34b9a5ba17482fafd",
} as const;

export const REVERTED_LIVE_EVIDENCE = {
  proofPath: "/evidence/reverted-live-proof.json",
  transactionHash: "0x2a0f80f0297f4cb0944471015a5cd3dec9f031c4c4dfe335a2a4ba6a6d82b865",
} as const;

export function xLayerTestnetTransactionUrl(transactionHash: string): string {
  if (!/^0x[\dA-Fa-f]{64}$/.test(transactionHash)) {
    throw new Error("X Layer explorer links require a complete transaction hash.");
  }
  return `${X_LAYER_TESTNET_EXPLORER}/tx/${transactionHash}`;
}
