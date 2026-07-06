import type { ObjectId } from "mongodb";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { NormalizedCheckoutEvent } from "./normalize";
import type {
  CheckoutEvent,
  AbandonedCheckout,
  Lead,
  RecoveryFlow,
  RecoveryFlowStep,
  ScheduledRecoveryMessage,
} from "@/lib/db/types";

async function upsertLeadFromEvent(
  accountId: string,
  data: {
    email: string | null;
    phone: string | null;
    status: string;
    /** Quando true, não sobrescreve o status de um lead já existente. */
    preserveStatus?: boolean;
    /** Origem do lead ao criar um novo registro. */
    source?: string;
    /** Registra data/hora do último contato (ex.: WhatsApp enviado). */
    contactedAt?: Date;
  }
) {
  if (!data.email && !data.phone) return;
  const leadsCol = await getCollection("leads");
  const filter: Record<string, unknown> = { accountId };
  if (data.email && data.phone) {
    filter.$or = [{ email: data.email }, { phone: data.phone }];
  } else if (data.email) {
    filter.email = data.email;
  } else {
    filter.phone = data.phone!;
  }
  const existing = await leadsCol.findOne(filter);
  const now = new Date();
  if (existing) {
    const update: Record<string, unknown> = { updatedAt: now };
    if (!data.preserveStatus) update.status = data.status;
    if (data.contactedAt) update.lastContactedAt = data.contactedAt;
    await leadsCol.updateOne(
      { _id: existing._id as ObjectId },
      { $set: update }
    );
  } else {
    await leadsCol.insertOne({
      accountId,
      email: data.email,
      phone: data.phone,
      name: null,
      source: data.source ?? "checkout",
      status: data.status,
      tags: [],
      ...(data.contactedAt ? { lastContactedAt: data.contactedAt } : {}),
      createdAt: now,
      updatedAt: now,
    } as Lead & { _id?: unknown });
  }
}

export async function processIncomingEvent(
  accountId: string,
  platform: "kiwify" | "hotmart" | "n8n",
  normalized: NormalizedCheckoutEvent
) {
  if (isDatabaseDisabled()) return;
  const checkoutEventsCol = await getCollection("checkoutEvents");
  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");

  const now = new Date();
  const eventDoc: CheckoutEvent = {
    accountId,
    platform,
    eventType: normalized.eventType,
    platformCheckoutId: normalized.platformCheckoutId ?? null,
    platformOrderId: normalized.platformOrderId ?? null,
    customerEmail: normalized.customerEmail ?? null,
    customerPhone: normalized.customerPhone ?? null,
    productId: normalized.productId ?? null,
    productName: normalized.productName ?? null,
    amount: normalized.amount ?? null,
    payload: (normalized.payload ?? {}) as Record<string, unknown>,
    createdAt: now,
  };
  const insertResult = await checkoutEventsCol.insertOne(eventDoc as CheckoutEvent & { _id?: unknown });
  const insertedId = insertResult.insertedId.toString();

  const isContactEvent = normalized.eventType === "whatsapp_enviado";

  if (normalized.customerEmail || normalized.customerPhone) {
    await upsertLeadFromEvent(accountId, {
      email: normalized.customerEmail ?? null,
      phone: normalized.customerPhone ?? null,
      status: normalized.eventType === "pagamento_aprovado" ? "purchased" : "lead",
      preserveStatus: isContactEvent,
      source: isContactEvent ? "whatsapp" : "checkout",
      contactedAt: isContactEvent ? now : undefined,
    });
  }

  if (isContactEvent) return;

  if (
    normalized.eventType === "pagamento_aprovado" &&
    normalized.platformCheckoutId
  ) {
    await abandonedCheckoutsCol.updateMany(
      {
        accountId,
        platformCheckoutId: normalized.platformCheckoutId,
      },
      { $set: { recoveredAt: now } }
    );
  }

  if (
    normalized.eventType === "checkout_abandonado" &&
    insertedId &&
    normalized.platformCheckoutId
  ) {
    await createAbandonedAndScheduleRecovery(
      accountId,
      insertedId,
      platform,
      normalized.platformCheckoutId,
      {
        customerEmail: normalized.customerEmail,
        customerPhone: normalized.customerPhone,
        productId: normalized.productId,
        productName: normalized.productName,
        amount: normalized.amount,
      }
    );
  }
}

export async function createAbandonedAndScheduleRecovery(
  accountId: string,
  checkoutEventId: string,
  platform: string,
  platformCheckoutId: string,
  data: {
    customerEmail?: string;
    customerPhone?: string;
    productId?: string;
    productName?: string;
    amount?: string;
  }
) {
  if (isDatabaseDisabled()) return;
  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");
  const recoveryFlowsCol = await getCollection("recoveryFlows");
  const recoveryFlowStepsCol = await getCollection("recoveryFlowSteps");
  const scheduledRecoveryMessagesCol = await getCollection("scheduledRecoveryMessages");

  const now = new Date();
  const abandonedDoc: AbandonedCheckout = {
    accountId,
    checkoutEventId,
    platform,
    platformCheckoutId,
    customerEmail: data.customerEmail ?? null,
    customerPhone: data.customerPhone ?? null,
    productId: data.productId ?? null,
    productName: data.productName ?? null,
    amount: data.amount ?? null,
    recoveredAt: null,
    createdAt: now,
  };
  const abandonedResult = await abandonedCheckoutsCol.insertOne(abandonedDoc as AbandonedCheckout & { _id?: unknown });
  const abandonedId = abandonedResult.insertedId.toString();

  const flows = await recoveryFlowsCol
    .find({ accountId, active: true })
    .toArray() as (RecoveryFlow & { _id: unknown })[];

  for (const flow of flows) {
    if (!flow._id) continue;
    const steps = await recoveryFlowStepsCol
      .find({ recoveryFlowId: flow._id.toString() })
      .sort({ orderIndex: 1 })
      .toArray() as (RecoveryFlowStep & { _id: unknown })[];

    for (const step of steps) {
      if (!step._id) continue;
      const runAt = new Date(Date.now() + step.delayMinutes * 60 * 1000);
      const msgDoc: ScheduledRecoveryMessage = {
        abandonedCheckoutId: abandonedId,
        recoveryFlowStepId: step._id.toString(),
        runAt,
        sentAt: null,
        status: "pending",
        createdAt: now,
      };
      await scheduledRecoveryMessagesCol.insertOne(msgDoc as ScheduledRecoveryMessage & { _id?: unknown });
    }
  }
}

export async function processAbandonmentForAccount(accountId: string) {
  if (isDatabaseDisabled()) return;
  const recoveryFlowsCol = await getCollection("recoveryFlows");
  const recoveryFlowStepsCol = await getCollection("recoveryFlowSteps");
  const checkoutEventsCol = await getCollection("checkoutEvents");
  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");
  const scheduledRecoveryMessagesCol = await getCollection("scheduledRecoveryMessages");

  const flows = await recoveryFlowsCol
    .find({ accountId, active: true })
    .project({ _id: 1, abandonmentMinutes: 1 })
    .toArray() as (RecoveryFlow & { _id: unknown })[];

  for (const flow of flows) {
    const cutoff = new Date(
      Date.now() - flow.abandonmentMinutes * 60 * 1000
    );

    const startedEvents = await checkoutEventsCol
      .find({
        accountId,
        eventType: "checkout_iniciado",
        createdAt: { $lte: cutoff },
      })
      .toArray() as (CheckoutEvent & { _id: unknown })[];

    for (const ev of startedEvents) {
      const platformCheckoutId = ev.platformCheckoutId;
      if (!platformCheckoutId || !ev._id) continue;

      const approved = await checkoutEventsCol.findOne({
        accountId,
        platformCheckoutId,
        eventType: "pagamento_aprovado",
      });
      if (approved) continue;

      const alreadyAbandoned = await abandonedCheckoutsCol.findOne({
        accountId,
        platformCheckoutId,
      });
      if (alreadyAbandoned) continue;

      await createAbandonedAndScheduleRecovery(
        accountId,
        ev._id.toString(),
        ev.platform,
        platformCheckoutId,
        {
          customerEmail: ev.customerEmail ?? undefined,
          customerPhone: ev.customerPhone ?? undefined,
          productId: ev.productId ?? undefined,
          productName: ev.productName ?? undefined,
          amount: ev.amount ?? undefined,
        }
      );
    }
  }
}
