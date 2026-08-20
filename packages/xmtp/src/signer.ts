import type { Identifier, Signer } from "@xmtp/node-sdk";
import { hexToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { MessageSigner } from "@metermesh/protocol";

export interface MeterMeshIdentity {
  envelopeSigner: MessageSigner;
  xmtpSigner: Signer;
}

export function createMeterMeshIdentity(privateKey: Hex): MeterMeshIdentity {
  const account = privateKeyToAccount(privateKey);

  return {
    envelopeSigner: {
      address: account.address,
      signMessage: (args) => account.signMessage(args),
    },
    xmtpSigner: {
      getIdentifier: () => ({
        identifier: account.address.toLowerCase(),
        // XMTP exposes this identifier kind as an ambient const enum.
        identifierKind: 0 as Identifier["identifierKind"],
      }),
      signMessage: async (message) => hexToBytes(await account.signMessage({ message })),
      type: "EOA",
    },
  };
}
