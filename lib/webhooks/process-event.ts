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
    name?: string | null;
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
    // Só preenche o nome se veio no evento e o lead ainda não tem nome.
    if (data.name && !(existing as { name?: string | null }).name) {
      update.name = data.name;
    }
    await leadsCol.updateOne(
      { _id: existing._id as ObjectId },
      { $set: update }
    );
  } else {
    await leadsCol.insertOne({
      accountId,
      email: data.email,
      phone: data.phone,
      name: data.name ?? null,
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
    currency: normalized.currency ?? null,
    fees: normalized.fees ?? null,
    affiliate: normalized.affiliate ?? null,
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
      name: normalized.customerName ?? null,
      status: normalized.eventType === "pagamento_aprovado" ? "purchased" : "lead",
      preserveStatus: isContactEvent,
      source: isContactEvent ? "whatsapp" : "checkout",
      contactedAt: isContactEvent ? now : undefined,
    });
  }

  if (isContactEvent) return;

  if (normalized.eventType === "pagamento_aprovado") {
    await markRecovered(accountId, normalized, now);
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
        currency: normalized.currency,
        fees: normalized.fees,
        affiliate: normalized.affiliate,
      }
    );
  }

  // Pagamento recusado é uma motion de recuperação distinta do abandono:
  // o cliente tentou pagar e o cartão/pix falhou. Registramos como recuperável
  // (recoveryType "refused") para o dashboard medir separadamente. O envio da
  // mensagem em si é feito pelo n8n (WhatsApp Cloud API).
  if (
    normalized.eventType === "pagamento_recusado" &&
    insertedId &&
    normalized.platformCheckoutId
  ) {
    await createRefusedRecoverable(
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
        currency: normalized.currency,
        fees: normalized.fees,
        affiliate: normalized.affiliate,
      }
    );
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function recoverMostRecent(
  col: Awaited<ReturnType<typeof getCollection>>,
  filter: Record<string, unknown>,
  recoverySet: Record<string, unknown>
): Promise<boolean> {
  const [doc] = (await col
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as { _id: ObjectId }[];
  if (!doc?._id) return false;
  await col.updateOne({ _id: doc._id }, { $set: recoverySet });
  return true;
}

/**
 * Marca um checkout recuperável como recuperado quando o cliente paga.
 * Vínculo em ordem de prioridade:
 *  1. Mesmo platformCheckoutId (quando o evento traz o checkout_id).
 *  2. Fallback: mesmo cliente (email OU telefone) + mesmo produto.
 *  3. Fallback final: mesmo cliente (email OU telefone), produto qualquer.
 *
 * Os fallbacks são necessários porque a API de vendas da Kiwify não devolve o
 * checkout_id do carrinho abandonado — o evento de aprovado chega com
 * checkoutId vazio, então casamos por "esse cliente pagou por esse produto".
 * Credita 1 recuperação por pagamento (registro não-recuperado mais recente).
 */
export async function markRecovered(
  accountId: string,
  normalized: NormalizedCheckoutEvent,
  now: Date
) {
  if (isDatabaseDisabled()) return;
  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");

  // Valor efetivamente pago (da venda aprovada), guardado no recuperado.
  // A moeda define em qual balde (R$ ou US$) o dashboard soma o valor.
  const recoverySet: Record<string, unknown> = {
    recoveredAt: now,
    recoveredAmount: normalized.amount ?? null,
    recoveredCurrency: normalized.currency ?? null,
    recoveredFees: normalized.fees ?? null,
  };

  // 1. Match direto por checkout, se o evento trouxer o id.
  if (normalized.platformCheckoutId) {
    const res = await abandonedCheckoutsCol.updateMany(
      {
        accountId,
        platformCheckoutId: normalized.platformCheckoutId,
        recoveredAt: null,
      },
      { $set: recoverySet }
    );
    if (((res as { modifiedCount?: number }).modifiedCount ?? 0) > 0) return;
  }

  const email = normalized.customerEmail?.trim();
  const phone = normalized.customerPhone?.trim();
  if (!email && !phone) return;

  const customerOr: Record<string, unknown>[] = [];
  if (email) customerOr.push({ customerEmail: email });
  if (phone) customerOr.push({ customerPhone: phone });
  const baseFilter: Record<string, unknown> = {
    accountId,
    recoveredAt: null,
    $or: customerOr,
  };

  // 2. Cliente + produto (case-insensitive). Sinal forte: creditamos.
  const product = normalized.productName?.trim();
  if (product) {
    const recovered = await recoverMostRecent(
      abandonedCheckoutsCol,
      {
        ...baseFilter,
        productName: { $regex: `^${escapeRegex(product)}$`, $options: "i" },
      },
      recoverySet
    );
    if (recovered) return;
  }

  // 3. Cliente sem match de produto: só credita se houver EXATAMENTE um
  // carrinho pendente. Com vários produtos pendentes não dá pra saber qual
  // foi pago, então não adivinhamos (evita inflar a taxa de recuperação).
  const pendentes = (await abandonedCheckoutsCol
    .find(baseFilter)
    .limit(2)
    .toArray()) as { _id: ObjectId }[];
  if (pendentes.length === 1 && pendentes[0]?._id) {
    await abandonedCheckoutsCol.updateOne(
      { _id: pendentes[0]._id },
      { $set: recoverySet }
    );
  }
}

/**
 * Registra um pagamento recusado como checkout recuperável, sem agendar
 * mensagens internas (o disparo é feito pelo n8n). Faz dedupe por checkout
 * para não duplicar quando a plataforma reenvia o evento de recusa.
 */
export async function createRefusedRecoverable(
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
    currency?: string;
    fees?: string;
    affiliate?: string;
  }
) {
  if (isDatabaseDisabled()) return;
  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");

  const existing = await abandonedCheckoutsCol.findOne({
    accountId,
    platformCheckoutId,
    recoveryType: "refused",
  });
  if (existing) return;

  const now = new Date();
  const doc: AbandonedCheckout = {
    accountId,
    checkoutEventId,
    platform,
    platformCheckoutId,
    recoveryType: "refused",
    customerEmail: data.customerEmail ?? null,
    customerPhone: data.customerPhone ?? null,
    productId: data.productId ?? null,
    productName: data.productName ?? null,
    affiliate: data.affiliate ?? null,
    amount: data.amount ?? null,
    currency: data.currency ?? null,
    fees: data.fees ?? null,
    recoveredAt: null,
    createdAt: now,
  };
  await abandonedCheckoutsCol.insertOne(
    doc as AbandonedCheckout & { _id?: unknown }
  );
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
    currency?: string;
    fees?: string;
    affiliate?: string;
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
    recoveryType: "abandoned",
    customerEmail: data.customerEmail ?? null,
    customerPhone: data.customerPhone ?? null,
    productId: data.productId ?? null,
    productName: data.productName ?? null,
    affiliate: data.affiliate ?? null,
    amount: data.amount ?? null,
    currency: data.currency ?? null,
    fees: data.fees ?? null,
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
          affiliate: ev.affiliate ?? undefined,
        }
      );
    }
  }
}
