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
    /**
     * Status final quando o evento é um pagamento aprovado, já resolvido pelo
     * chamador: "purchased" (recuperado — tinha carrinho rastreado) ou "paid"
     * (venda direta, finalizou sozinha). Quando presente, vence o `status`.
     */
    purchaseStatus?: "purchased" | "paid";
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

  const effectiveStatus = data.purchaseStatus ?? data.status;

  if (existing) {
    const update: Record<string, unknown> = { updatedAt: now };
    if (!data.preserveStatus) update.status = effectiveStatus;
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
      status: effectiveStatus,
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

  // Idempotência: o n8n re-envia periodicamente as listas (aprovados, recusados,
  // etc.), então o MESMO checkout no MESMO tipo de evento chega várias vezes.
  // Não podemos duplicar o registro — o histórico de interações e as métricas
  // ficariam inflados. Uma nova compra teria um checkoutId diferente, aí sim
  // vira um novo registro. Exceção: WhatsApp, onde cada envio é uma interação
  // real e distinta.
  if (
    normalized.platformCheckoutId &&
    normalized.eventType !== "whatsapp_enviado" &&
    normalized.eventType !== "whatsapp_status"
  ) {
    const duplicate = await checkoutEventsCol.findOne({
      accountId,
      eventType: normalized.eventType,
      platformCheckoutId: normalized.platformCheckoutId,
    });
    if (duplicate) return;
  }

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
    // "Comprou" (recuperado) só se o cliente tem um carrinho rastreado por nós
    // (abandono ou recusa). Sem carrinho = venda direta = "Pago" (finalizou
    // sozinha). Usamos a existência do carrinho, não a origem do lead, porque
    // esse sinal é estável e não depende da ordem dos eventos.
    let purchaseStatus: "purchased" | "paid" | undefined;
    if (normalized.eventType === "pagamento_aprovado") {
      const customerOr = [
        ...(normalized.customerEmail
          ? [{ customerEmail: normalized.customerEmail }]
          : []),
        ...(normalized.customerPhone
          ? [{ customerPhone: normalized.customerPhone }]
          : []),
      ];
      const carrinho = await abandonedCheckoutsCol.findOne({
        accountId,
        $or: customerOr,
      });
      purchaseStatus = carrinho ? "purchased" : "paid";
    }

    await upsertLeadFromEvent(accountId, {
      email: normalized.customerEmail ?? null,
      phone: normalized.customerPhone ?? null,
      name: normalized.customerName ?? null,
      status: "lead",
      preserveStatus: isContactEvent,
      purchaseStatus,
      source:
        normalized.eventType === "pagamento_aprovado"
          ? "approved"
          : isContactEvent
          ? "whatsapp"
          : "checkout",
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
  if (normalized.eventType === "pagamento_recusado" && insertedId) {
    // O checkoutId é o ideal para dedupe, mas se vier vazio (como já aconteceu
    // no pagamento_aprovado) montamos uma chave por email+produto para o
    // recusado nunca se perder.
    const refusedKey =
      normalized.platformCheckoutId ||
      (normalized.customerEmail
        ? `refused:${normalized.customerEmail}:${normalized.productName ?? ""}`
        : normalized.customerPhone
        ? `refused:${normalized.customerPhone}:${normalized.productName ?? ""}`
        : null);
    if (refusedKey) {
      await createRefusedRecoverable(
        accountId,
        insertedId,
        platform,
        refusedKey,
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
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Afiliado elegível para creditar recuperação à LoopSale: venda SEM afiliado
 * ou com afiliado que contenha "mios tech". Se a venda saiu por outro afiliado,
 * o crédito é dele — não é uma recuperação nossa.
 */
function affiliateElegivel(affiliate?: string | null): boolean {
  const a = (affiliate ?? "").trim().toLowerCase();
  if (!a) return true;
  return a.includes("mios tech") || a.includes("miostech");
}

/**
 * Venda com afiliado "mios tech": a comissão da LoopSale já foi paga na Kiwify
 * (como afiliado) no momento da compra. Conta como venda recuperada, mas NÃO
 * entra na cobrança dos 40% (senão seria dobrado).
 */
function comissaoJaPagaNaKiwify(affiliate?: string | null): boolean {
  const a = (affiliate ?? "").trim().toLowerCase();
  return a.includes("mios tech") || a.includes("miostech");
}

/** Encontra o carrinho candidato (não recuperado) para este pagamento. */
async function findRecoverableCandidate(
  col: Awaited<ReturnType<typeof getCollection>>,
  accountId: string,
  normalized: NormalizedCheckoutEvent
): Promise<{ _id: ObjectId; createdAt: Date } | null> {
  const email = normalized.customerEmail?.trim();
  const phone = normalized.customerPhone?.trim();

  // 1. Match direto por checkout, se o evento trouxer o id.
  if (normalized.platformCheckoutId) {
    const doc = (await col.findOne({
      accountId,
      platformCheckoutId: normalized.platformCheckoutId,
      recoveredAt: null,
    })) as { _id: ObjectId; createdAt: Date } | null;
    if (doc?._id) return doc;
  }

  if (!email && !phone) return null;
  const customerOr: Record<string, unknown>[] = [];
  if (email) customerOr.push({ customerEmail: email });
  if (phone) customerOr.push({ customerPhone: phone });
  const baseFilter: Record<string, unknown> = {
    accountId,
    recoveredAt: null,
    $or: customerOr,
  };

  // 2. Cliente + mesmo produto (case-insensitive) — mais recente.
  const product = normalized.productName?.trim();
  if (product) {
    const [doc] = (await col
      .find({
        ...baseFilter,
        productName: { $regex: `^${escapeRegex(product)}$`, $options: "i" },
      })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray()) as { _id: ObjectId; createdAt: Date }[];
    if (doc?._id) return doc;
  }

  // 3. Cliente com EXATAMENTE um carrinho pendente (evita adivinhar produto).
  const pendentes = (await col.find(baseFilter).limit(2).toArray()) as {
    _id: ObjectId;
    createdAt: Date;
  }[];
  if (pendentes.length === 1 && pendentes[0]?._id) return pendentes[0];
  return null;
}

/**
 * Marca um checkout como recuperado quando o cliente paga — mas SÓ se for uma
 * recuperação de fato da LoopSale, exigindo os 3 critérios:
 *  1. Afiliado elegível: sem afiliado ou "mios tech" (senão é venda de outro).
 *  2. Existe carrinho abandonado/recusado desse cliente para o produto.
 *  3. Veio do fluxo: houve WhatsApp enviado a esse cliente ENTRE o abandono e
 *     o pagamento (a mensagem precede a compra).
 * Só então grava recoveredAt + valores pagos.
 */
export async function markRecovered(
  accountId: string,
  normalized: NormalizedCheckoutEvent,
  now: Date
) {
  if (isDatabaseDisabled()) return;

  // 1. Regra de afiliado.
  if (!affiliateElegivel(normalized.affiliate)) return;

  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");
  const checkoutEventsCol = await getCollection("checkoutEvents");

  // 2. Carrinho candidato.
  const candidate = await findRecoverableCandidate(
    abandonedCheckoutsCol,
    accountId,
    normalized
  );
  if (!candidate?._id) return;

  // 3. Veio do fluxo: WhatsApp enviado ao cliente entre o abandono e o pagamento.
  const email = normalized.customerEmail?.trim();
  const phone = normalized.customerPhone?.trim();
  const msgOr: Record<string, unknown>[] = [];
  if (email) msgOr.push({ customerEmail: email });
  if (phone) msgOr.push({ customerPhone: phone });
  if (msgOr.length === 0) return;

  const messaged = await checkoutEventsCol.findOne({
    accountId,
    eventType: "whatsapp_enviado",
    $or: msgOr,
    createdAt: { $gte: candidate.createdAt, $lte: now },
  });
  if (!messaged) return; // pagou, mas não veio do nosso fluxo de recuperação

  // Valor efetivamente pago (da venda aprovada), guardado no recuperado.
  await abandonedCheckoutsCol.updateOne(
    { _id: candidate._id },
    {
      $set: {
        recoveredAt: now,
        recoveredAmount: normalized.amount ?? null,
        recoveredCurrency: normalized.currency ?? null,
        recoveredFees: normalized.fees ?? null,
        recoveredAffiliate: normalized.affiliate ?? null,
        // Se a venda saiu pelo afiliado Mios Tech, a comissão já foi paga na
        // Kiwify; não entra na cobrança dos 40%.
        commissionPaidKiwify: comissaoJaPagaNaKiwify(normalized.affiliate),
      },
    }
  );
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
