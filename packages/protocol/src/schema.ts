import { getAddress, isAddress, isHash, type Address, type Hex } from "viem";
import { z } from "zod";

const boundedIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const decimalAmountPattern = /^(0|[1-9][0-9]*)$/;
const signaturePattern = /^0x[0-9a-fA-F]{130}$/;

export const boundedIdSchema = z.string().regex(boundedIdPattern);
export const amountSchema = z.string().regex(decimalAmountPattern);
export const positiveAmountSchema = amountSchema.refine((value) => BigInt(value) > 0n, {
  message: "Amount must be greater than zero.",
});
export const addressSchema = z
  .string()
  .refine((value) => isAddress(value), { message: "Invalid EVM address." })
  .transform((value): Address => getAddress(value));
export const hashSchema = z
  .string()
  .refine((value) => isHash(value), { message: "Expected a 32-byte hash." })
  .transform((value): Hex => value.toLowerCase() as Hex);
export const signatureSchema = z
  .string()
  .regex(signaturePattern)
  .transform((value): Hex => value.toLowerCase() as Hex);

export const requestPayloadSchema = z.strictObject({
  transactionHash: hashSchema,
  workUnitId: boundedIdSchema,
});

export const deliveryPayloadSchema = z.strictObject({
  deliverySchema: z.literal("metermesh.transaction-explanation.v1"),
  requestMessageId: boundedIdSchema,
  resultHash: hashSchema,
  transactionHash: hashSchema,
  workUnitId: boundedIdSchema,
});

export const acceptancePayloadSchema = z.strictObject({
  cumulativeAmount: positiveAmountSchema,
  deliveryMessageId: boundedIdSchema,
  deliveryPayloadHash: hashSchema,
  voucherCredentialHash: hashSchema,
  workUnitId: boundedIdSchema,
});

export const rejectionPayloadSchema = z.strictObject({
  deliveryMessageId: boundedIdSchema,
  deliveryPayloadHash: hashSchema,
  reason: z.enum(["buyer_declined", "evidence_mismatch", "invalid_delivery"]),
  workUnitId: boundedIdSchema,
});

export const closePayloadSchema = z.strictObject({
  closeCredentialHash: hashSchema,
  finalCumulativeAmount: amountSchema,
});

const draftHeaderShape = {
  createdAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString()),
  messageId: boundedIdSchema,
  protocol: z.literal("metermesh"),
  senderInboxId: boundedIdSchema,
  sequence: z.number().int().positive(),
  sessionId: boundedIdSchema,
  version: z.literal(1),
};

const requestDraftSchema = z.strictObject({
  ...draftHeaderShape,
  payload: requestPayloadSchema,
  type: z.literal("work.request"),
});
const deliveryDraftSchema = z.strictObject({
  ...draftHeaderShape,
  payload: deliveryPayloadSchema,
  type: z.literal("work.delivery"),
});
const acceptanceDraftSchema = z.strictObject({
  ...draftHeaderShape,
  payload: acceptancePayloadSchema,
  type: z.literal("work.accept"),
});
const rejectionDraftSchema = z.strictObject({
  ...draftHeaderShape,
  payload: rejectionPayloadSchema,
  type: z.literal("work.reject"),
});
const closeDraftSchema = z.strictObject({
  ...draftHeaderShape,
  payload: closePayloadSchema,
  type: z.literal("session.close"),
});

export const envelopeDraftSchema = z.discriminatedUnion("type", [
  requestDraftSchema,
  deliveryDraftSchema,
  acceptanceDraftSchema,
  rejectionDraftSchema,
  closeDraftSchema,
]);

const signatureFields = {
  signature: z.strictObject({
    scheme: z.literal("eip191"),
    signer: addressSchema,
    value: signatureSchema,
  }),
};
const payloadHashFields = { payloadHash: hashSchema };

export const unsignedEnvelopeSchema = z.discriminatedUnion("type", [
  requestDraftSchema.extend(payloadHashFields),
  deliveryDraftSchema.extend(payloadHashFields),
  acceptanceDraftSchema.extend(payloadHashFields),
  rejectionDraftSchema.extend(payloadHashFields),
  closeDraftSchema.extend(payloadHashFields),
]);

export const envelopeSchema = z.discriminatedUnion("type", [
  requestDraftSchema.extend({ ...payloadHashFields, ...signatureFields }),
  deliveryDraftSchema.extend({ ...payloadHashFields, ...signatureFields }),
  acceptanceDraftSchema.extend({ ...payloadHashFields, ...signatureFields }),
  rejectionDraftSchema.extend({ ...payloadHashFields, ...signatureFields }),
  closeDraftSchema.extend({ ...payloadHashFields, ...signatureFields }),
]);

export const sessionPartySchema = z.strictObject({
  address: addressSchema,
  inboxId: boundedIdSchema,
});

export const sessionConfigSchema = z
  .strictObject({
    buyer: sessionPartySchema,
    cap: positiveAmountSchema,
    chainId: z.number().int().positive(),
    channelId: hashSchema,
    escrowAddress: addressSchema,
    seller: sessionPartySchema,
    sessionId: boundedIdSchema,
    tokenAddress: addressSchema,
    unitPrice: positiveAmountSchema,
  })
  .superRefine((value, context) => {
    if (BigInt(value.unitPrice) > BigInt(value.cap)) {
      context.addIssue({
        code: "custom",
        message: "Unit price cannot exceed the session cap.",
        path: ["unitPrice"],
      });
    }
    if (value.buyer.inboxId === value.seller.inboxId) {
      context.addIssue({
        code: "custom",
        message: "Buyer and seller inboxes must differ.",
        path: ["seller", "inboxId"],
      });
    }
    if (value.buyer.address === value.seller.address) {
      context.addIssue({
        code: "custom",
        message: "Buyer and seller addresses must differ.",
        path: ["seller", "address"],
      });
    }
  });

const requestedWorkUnitSchema = z.strictObject({
  requestMessageId: boundedIdSchema,
  status: z.literal("requested"),
  transactionHash: hashSchema,
  workUnitId: boundedIdSchema,
});
const deliveredWorkUnitSchema = requestedWorkUnitSchema.extend({
  deliveryMessageId: boundedIdSchema,
  deliveryPayloadHash: hashSchema,
  resultHash: hashSchema,
  status: z.literal("delivered"),
});
const acceptedWorkUnitSchema = deliveredWorkUnitSchema.extend({
  acceptanceMessageId: boundedIdSchema,
  cumulativeAmount: positiveAmountSchema,
  status: z.literal("accepted"),
  voucherCredentialHash: hashSchema,
});
const rejectedWorkUnitSchema = deliveredWorkUnitSchema.extend({
  reason: rejectionPayloadSchema.shape.reason,
  rejectionMessageId: boundedIdSchema,
  status: z.literal("rejected"),
});

export const workUnitSchema = z.discriminatedUnion("status", [
  requestedWorkUnitSchema,
  deliveredWorkUnitSchema,
  acceptedWorkUnitSchema,
  rejectedWorkUnitSchema,
]);

export const settlementReceiptSchema = z.strictObject({
  amount: amountSchema,
  chainId: z.number().int().positive(),
  channelId: hashSchema,
  confirmedAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString()),
  status: z.literal("success"),
  transactionHash: hashSchema,
});

export const sessionStateSchema = z
  .strictObject({
    acceptedUnits: z.number().int().nonnegative(),
    closeRequest: z
      .strictObject({
        closeCredentialHash: hashSchema,
        messageId: boundedIdSchema,
      })
      .nullable(),
    config: sessionConfigSchema,
    highestVoucherAmount: amountSchema,
    lastSequences: z.array(
      z.strictObject({
        inboxId: boundedIdSchema,
        sequence: z.number().int().nonnegative(),
      }),
    ),
    processedMessageIds: z.array(boundedIdSchema),
    protocolVersion: z.literal(1),
    rejectedUnits: z.number().int().nonnegative(),
    settlement: settlementReceiptSchema.nullable(),
    status: z.enum(["open", "closing", "closed"]),
    workUnits: z.array(workUnitSchema),
  })
  .superRefine((value, context) => {
    const duplicate = (items: readonly string[]) => new Set(items).size !== items.length;
    if (duplicate(value.processedMessageIds)) {
      context.addIssue({ code: "custom", message: "Processed message IDs must be unique." });
    }
    if (duplicate(value.lastSequences.map(({ inboxId }) => inboxId))) {
      context.addIssue({ code: "custom", message: "Sequence entries must be unique by inbox." });
    }
    if (
      value.lastSequences.some(
        ({ inboxId }) =>
          inboxId !== value.config.buyer.inboxId && inboxId !== value.config.seller.inboxId,
      )
    ) {
      context.addIssue({ code: "custom", message: "Sequence state contains an unknown inbox." });
    }
    if (duplicate(value.workUnits.map(({ workUnitId }) => workUnitId))) {
      context.addIssue({ code: "custom", message: "Work-unit IDs must be unique." });
    }

    const accepted = value.workUnits.filter((unit) => unit.status === "accepted");
    const rejected = value.workUnits.filter((unit) => unit.status === "rejected");
    if (accepted.length !== value.acceptedUnits || rejected.length !== value.rejectedUnits) {
      context.addIssue({ code: "custom", message: "Work-unit counters do not match state." });
    }

    const referencedMessageIds = value.workUnits.flatMap((unit) => {
      const ids = [unit.requestMessageId];
      if (unit.status !== "requested") ids.push(unit.deliveryMessageId);
      if (unit.status === "accepted") ids.push(unit.acceptanceMessageId);
      if (unit.status === "rejected") ids.push(unit.rejectionMessageId);
      return ids;
    });
    if (value.closeRequest !== null) referencedMessageIds.push(value.closeRequest.messageId);
    if (
      duplicate(referencedMessageIds) ||
      referencedMessageIds.length !== value.processedMessageIds.length ||
      referencedMessageIds.some((id) => !value.processedMessageIds.includes(id))
    ) {
      context.addIssue({
        code: "custom",
        message: "Processed messages do not match work history.",
      });
    }

    const buyerMessageCount =
      value.workUnits.length +
      accepted.length +
      rejected.length +
      (value.closeRequest === null ? 0 : 1);
    const sellerMessageCount = value.workUnits.filter((unit) => unit.status !== "requested").length;
    const storedSequence = (inboxId: string) =>
      value.lastSequences.find((entry) => entry.inboxId === inboxId)?.sequence ?? 0;
    if (
      storedSequence(value.config.buyer.inboxId) !== buyerMessageCount ||
      storedSequence(value.config.seller.inboxId) !== sellerMessageCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Sequence counters do not match message history.",
      });
    }

    const expectedHighest = BigInt(value.config.unitPrice) * BigInt(value.acceptedUnits);
    if (BigInt(value.highestVoucherAmount) !== expectedHighest) {
      context.addIssue({ code: "custom", message: "Highest voucher amount is inconsistent." });
    }
    if (expectedHighest > BigInt(value.config.cap)) {
      context.addIssue({ code: "custom", message: "Highest voucher exceeds the session cap." });
    }
    const acceptedAmounts = accepted.map((unit) => BigInt(unit.cumulativeAmount));
    const uniqueAcceptedAmounts = new Set(acceptedAmounts.map(String));
    const everyAcceptedAmountIsExpected = acceptedAmounts.every(
      (amount) =>
        amount > 0n && amount <= expectedHighest && amount % BigInt(value.config.unitPrice) === 0n,
    );
    if (uniqueAcceptedAmounts.size !== accepted.length || !everyAcceptedAmountIsExpected) {
      context.addIssue({ code: "custom", message: "Accepted voucher amounts are inconsistent." });
    }
    if ((value.status === "open") !== (value.closeRequest === null)) {
      context.addIssue({ code: "custom", message: "Close request does not match session status." });
    }
    if ((value.status === "closed") !== (value.settlement !== null)) {
      context.addIssue({
        code: "custom",
        message: "Only closed sessions have settlement receipts.",
      });
    }
    if (value.settlement !== null) {
      if (value.settlement.chainId !== value.config.chainId) {
        context.addIssue({ code: "custom", message: "Settlement chain does not match session." });
      }
      if (value.settlement.channelId !== value.config.channelId) {
        context.addIssue({ code: "custom", message: "Settlement channel does not match session." });
      }
      if (value.settlement.amount !== value.highestVoucherAmount) {
        context.addIssue({ code: "custom", message: "Settlement amount does not match voucher." });
      }
    }
  });

export type Envelope = z.infer<typeof envelopeSchema>;
export type EnvelopeDraft = z.input<typeof envelopeDraftSchema>;
export type SettlementReceipt = z.infer<typeof settlementReceiptSchema>;
export type SessionConfig = z.infer<typeof sessionConfigSchema>;
export type SessionState = z.infer<typeof sessionStateSchema>;
export type UnsignedEnvelope = z.infer<typeof unsignedEnvelopeSchema>;
export type WorkUnit = z.infer<typeof workUnitSchema>;
