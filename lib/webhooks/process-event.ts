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

/**
 * Prioridade da origem do lead. "whatsapp" é só um placeholder (é a NOSSA ação
 * de saída, nunca a origem real do cliente) e sempre cede para uma origem de
 * verdade. Entre as reais: recusa > checkout (abandono) > venda direta. "manual"
 * é uma escolha humana e nunca é sobrescrita por eventos.
 */
function sourceRank(source?: string | null): number {
  const order: Record<string, number> = {
    whatsapp: 0,
    approved: 1,
    checkout: 2,
    refused: 3,
    manual: 9,
  };
  return order[(source ?? "").toLowerCase()] ?? 2;
}

/** Canoniza o status de entrega do WhatsApp. */
function normalizeMsgStatus(raw?: string | null): string | null {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return null;
  if (/read|lida|visualiz|seen/.test(s)) return "read";
  if (/deliver|entregue/.test(s)) return "delivered";
  if (/fail|falh|undeliver|error|erro/.test(s)) return "failed";
  if (/sent|enviad/.test(s)) return "sent";
  if (/accept|aceit|queued|fila|pend/.test(s)) return "accepted";
  return null;
}

/** Ordem de progressão (só avança). */
function msgStatusRank(s?: string | null): number {
  const order: Record<string, number> = {
    accepted: 0,
    sent: 1,
    delivered: 2,
    read: 3,
  };
  return order[s ?? ""] ?? -1;
}

/**
 * Casa um callback whatsapp_status com a mensagem enviada (pelo wamid) e atualiza
 * o status de entrega — só progride (accepted→sent→delivered→read); "failed" só
 * grava se ainda não tinha entregado/lido. Não cria entrada própria no histórico.
 */
async function applyWhatsappStatus(
  accountId: string,
  normalized: NormalizedCheckoutEvent
) {
  if (isDatabaseDisabled()) return;
  const wamid = normalized.whatsappMessageId;
  const status = normalizeMsgStatus(normalized.messageStatus);
  if (!wamid || !status) return;

  const col = await getCollection("checkoutEvents");
  const send = (await col.findOne({
    accountId,
    eventType: "whatsapp_enviado",
    whatsappMessageId: wamid,
  })) as (CheckoutEvent & { _id: ObjectId }) | null;
  if (!send) return; // status chegou antes do envio (fora de ordem): ignora

  const cur = send.whatsappStatus ?? null;
  const avanca =
    status === "failed"
      ? cur !== "read" && cur !== "delivered"
      : msgStatusRank(status) > msgStatusRank(cur);
  if (avanca) {
    await col.updateOne(
      { _id: send._id },
      { $set: { whatsappStatus: status } }
    );
  }
}

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
    // Atualiza a origem quando o evento atual revela uma origem mais forte que a
    // atual (ex.: "whatsapp" é só um placeholder e cede para checkout/recusado).
    const curSource = (existing as { source?: string | null }).source;
    if (data.source && sourceRank(data.source) > sourceRank(curSource)) {
      update.source = data.source;
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
    normalized.eventType !== "whatsapp_status" &&
    // Reembolso muda de status (pending→refunded→cancelled) no mesmo pedido;
    // cada atualização precisa ser processada, então não deduplica.
    normalized.eventType !== "reembolso"
  ) {
    const duplicate = await checkoutEventsCol.findOne({
      accountId,
      eventType: normalized.eventType,
      platformCheckoutId: normalized.platformCheckoutId,
    });
    if (duplicate) return;
  }

  // WhatsApp: cada mensagem é uma interação distinta, mas o mesmo envio (mesmo
  // wamid) não pode duplicar se o n8n reenviar a lista. Deduplica por wamid.
  if (normalized.eventType === "whatsapp_enviado" && normalized.whatsappMessageId) {
    const dupWa = await checkoutEventsCol.findOne({
      accountId,
      eventType: "whatsapp_enviado",
      whatsappMessageId: normalized.whatsappMessageId,
    });
    if (dupWa) return;
  }

  // Callback de status do WhatsApp: não vira entrada própria no histórico —
  // atualiza o status de entrega da mensagem enviada (casado por wamid).
  if (normalized.eventType === "whatsapp_status") {
    await applyWhatsappStatus(accountId, normalized);
    return;
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
    whatsappMessageId: normalized.whatsappMessageId ?? null,
    whatsappStatus:
      normalized.eventType === "whatsapp_enviado"
        ? normalizeMsgStatus(normalized.messageStatus)
        : null,
    payload: (normalized.payload ?? {}) as Record<string, unknown>,
    createdAt: now,
  };
  const insertResult = await checkoutEventsCol.insertOne(eventDoc as CheckoutEvent & { _id?: unknown });
  const insertedId = insertResult.insertedId.toString();

  const isContactEvent = normalized.eventType === "whatsapp_enviado";

  if (normalized.customerEmail || normalized.customerPhone) {
    // "Comprou" (recuperado) se o cliente passou pelo NOSSO funil: afiliado Mios
    // Tech (prova pelo afiliado) OU carrinho rastreado (abandono/recusa) OU já
    // enviamos um WhatsApp de recuperação. Qualquer um basta — o afiliado/WhatsApp
    // cobrem os casos em que o abandono não chegou ao LoopSale. Sem nenhum sinal =
    // venda direta = "Pago". Usamos os eventos/afiliado, não a origem do lead,
    // porque esse sinal é estável e independe da ordem.
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
      let veioDoFunil = comissaoJaPagaNaKiwify(normalized.affiliate);
      if (!veioDoFunil) {
        const carrinho = await abandonedCheckoutsCol.findOne({
          accountId,
          $or: customerOr,
        });
        veioDoFunil = !!carrinho;
      }
      if (!veioDoFunil) {
        const whatsapp = await checkoutEventsCol.findOne({
          accountId,
          eventType: "whatsapp_enviado",
          $or: customerOr,
        });
        veioDoFunil = !!whatsapp;
      }
      purchaseStatus = veioDoFunil ? "purchased" : "paid";
    }

    await upsertLeadFromEvent(accountId, {
      email: normalized.customerEmail ?? null,
      phone: normalized.customerPhone ?? null,
      name: normalized.customerName ?? null,
      status: "lead",
      // Reembolso não deve rebaixar o status aqui — quem decide é applyRefund.
      preserveStatus: isContactEvent || normalized.eventType === "reembolso",
      purchaseStatus,
      source:
        normalized.eventType === "pagamento_aprovado"
          ? "approved"
          : normalized.eventType === "pagamento_recusado"
          ? "refused"
          : isContactEvent
          ? "whatsapp"
          : "checkout",
      contactedAt: isContactEvent ? now : undefined,
    });
  }

  if (isContactEvent) return;

  if (normalized.eventType === "pagamento_aprovado") {
    // Marca o(s) carrinho(s) desse cliente/produto como pagos (sai do "valor em
    // risco") e, se for recuperação de fato, marca recoveredAt.
    await markCartsPaid(accountId, normalized, now);
    await markRecovered(accountId, normalized, now);
  }

  if (normalized.eventType === "reembolso") {
    await applyRefund(accountId, normalized, now);
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
 * Marca como pago (`paidAt`) qualquer carrinho pendente do mesmo cliente para o
 * mesmo produto quando chega um pagamento aprovado — independentemente de contar
 * como recuperação nossa (afiliado/WhatsApp). Serve para tirar do "valor em
 * risco" o que já foi efetivamente vendido.
 */
async function markCartsPaid(
  accountId: string,
  normalized: NormalizedCheckoutEvent,
  now: Date
) {
  if (isDatabaseDisabled()) return;
  const email = normalized.customerEmail?.trim();
  const phone = normalized.customerPhone?.trim();
  const product = normalized.productName?.trim();
  if ((!email && !phone) || !product) return;

  const customerOr: Record<string, unknown>[] = [];
  if (email) customerOr.push({ customerEmail: email });
  if (phone) customerOr.push({ customerPhone: phone });

  const col = await getCollection("abandonedCheckouts");
  await col.updateMany(
    {
      accountId,
      paidAt: null,
      $or: customerOr,
      productName: { $regex: `^${escapeRegex(product)}$`, $options: "i" },
    },
    { $set: { paidAt: now } }
  );
}

/** Interpreta o status cru do reembolso em pending/refunded/cancelled. */
function normalizeRefundStatus(
  raw?: string | null
): "pending" | "refunded" | "cancelled" {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("pend")) return "pending";
  // "refunded", vazio ou desconhecido = reembolso efetivado.
  return "refunded";
}

/** Interpreta o solicitante do reembolso em "buyer" | "seller" (ou null). */
function normalizeRefundRequester(raw?: string | null): string | null {
  const s = (raw ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("sell") || s.includes("vend") || s.includes("loj")) return "seller";
  if (s.includes("buy") || s.includes("compr") || s.includes("client")) return "buyer";
  return s;
}

/**
 * Aplica um evento de reembolso à venda recuperada do cliente+produto:
 *  - pending/refunded → cancela a comissão (grava refundStatus no carrinho) e
 *    marca o lead como "refunded".
 *  - cancelled → o pedido de reembolso caiu: a venda volta a valer (comissão) e
 *    o lead volta a "purchased".
 * Tudo fica registrado no histórico (o próprio checkout_event). Uma compra futura
 * do mesmo produto gera um novo carrinho e pode ser recuperada normalmente.
 */
async function applyRefund(
  accountId: string,
  normalized: NormalizedCheckoutEvent,
  now: Date
) {
  if (isDatabaseDisabled()) return;
  const status = normalizeRefundStatus(normalized.refundStatus);
  const email = normalized.customerEmail?.trim();
  const phone = normalized.customerPhone?.trim();
  const product = normalized.productName?.trim();
  if ((!email && !phone) || !product) return;

  const reason = (normalized.payload?.motivo ??
    normalized.payload?.reason ??
    null) as string | null;
  const requester = normalizeRefundRequester(normalized.refundRequester);

  // Atualiza a(s) venda(s) recuperada(s) desse cliente+produto.
  const cartOr: Record<string, unknown>[] = [];
  if (email) cartOr.push({ customerEmail: email });
  if (phone) cartOr.push({ customerPhone: phone });
  const col = await getCollection("abandonedCheckouts");
  await col.updateMany(
    {
      accountId,
      recoveredAt: { $ne: null },
      $or: cartOr,
      productName: { $regex: `^${escapeRegex(product)}$`, $options: "i" },
    },
    {
      $set: {
        refundStatus: status,
        refundRequestedAt: now,
        refundReason: reason,
        refundRequester: requester,
      },
    }
  );

  // Reflete no status do lead (leads usam email/phone, não customerEmail).
  //  - cancelled → volta a "purchased".
  //  - reembolso do seller → "retained" (sinalizado, comissão retida).
  //  - reembolso do buyer → "refunded".
  const leadStatus =
    status === "cancelled"
      ? "purchased"
      : requester === "seller"
      ? "retained"
      : "refunded";
  const leadOr: Record<string, unknown>[] = [];
  if (email) leadOr.push({ email });
  if (phone) leadOr.push({ phone });
  const leadsCol = await getCollection("leads");
  await leadsCol.updateOne(
    { accountId, $or: leadOr },
    { $set: { status: leadStatus, updatedAt: now } }
  );
}

/**
 * Marca um checkout como recuperado quando o cliente paga — SÓ se for uma
 * recuperação de fato da LoopSale. Duas formas de atribuir:
 *
 *  A) Afiliado "Mios Tech" (nosso afiliado de recuperação, exclusivo): o próprio
 *     afiliado PROVA que a venda veio do nosso fluxo (o link estava na mensagem).
 *     Marca o carrinho se existir; se não existir, cria um registro (backup),
 *     porque às vezes o abandono/WhatsApp não chega ao LoopSale.
 *
 *  B) Sem afiliado: não dá pra distinguir de venda orgânica, então exige o
 *     rastro completo — carrinho abandonado/recusado + WhatsApp enviado ENTRE o
 *     abandono e o pagamento.
 *
 * Outro afiliado (não Mios) = venda de terceiro: não é nossa recuperação.
 */
export async function markRecovered(
  accountId: string,
  normalized: NormalizedCheckoutEvent,
  now: Date
) {
  if (isDatabaseDisabled()) return;

  // Afiliado de terceiro = não é nossa.
  if (!affiliateElegivel(normalized.affiliate)) return;

  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");
  const checkoutEventsCol = await getCollection("checkoutEvents");
  const isMios = comissaoJaPagaNaKiwify(normalized.affiliate);

  const candidate = await findRecoverableCandidate(
    abandonedCheckoutsCol,
    accountId,
    normalized
  );

  if (candidate?._id) {
    // Sem afiliado, exige o WhatsApp entre o abandono e o pagamento. Com Mios,
    // o afiliado já prova — dispensa o WhatsApp.
    if (!isMios) {
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
      if (!messaged) return; // pagou, mas não veio do nosso fluxo
    }

    await abandonedCheckoutsCol.updateOne(
      { _id: candidate._id },
      {
        $set: {
          recoveredAt: now,
          recoveredAmount: normalized.amount ?? null,
          recoveredCurrency: normalized.currency ?? null,
          recoveredFees: normalized.fees ?? null,
          recoveredAffiliate: normalized.affiliate ?? null,
          commissionPaidKiwify: isMios,
        },
      }
    );
    return;
  }

  // Sem carrinho: só o afiliado Mios permite atribuir (backup por afiliado).
  if (isMios) {
    await createSyntheticRecovery(accountId, normalized, now);
  }
}

/**
 * Backup por afiliado: chega um pagamento com afiliado Mios Tech mas NÃO existe
 * carrinho rastreado (o abandono/WhatsApp não chegou ao LoopSale). Cria um
 * registro de recuperação a partir da própria venda, para contar no funil. O
 * afiliado Mios prova que veio do nosso fluxo; a comissão já foi paga na Kiwify.
 */
async function createSyntheticRecovery(
  accountId: string,
  normalized: NormalizedCheckoutEvent,
  now: Date
) {
  const col = await getCollection("abandonedCheckouts");
  const email = normalized.customerEmail?.trim();
  const phone = normalized.customerPhone?.trim();
  const product = normalized.productName?.trim();

  // Idempotência: não duplica se já registramos esta venda (mesmo checkoutId)...
  const saleId = normalized.platformCheckoutId;
  if (saleId) {
    const dup = await col.findOne({ accountId, platformCheckoutId: saleId });
    if (dup) return;
  }
  // ...nem se já existe uma recuperação desse cliente para o mesmo produto.
  if (product && (email || phone)) {
    const customerOr: Record<string, unknown>[] = [];
    if (email) customerOr.push({ customerEmail: email });
    if (phone) customerOr.push({ customerPhone: phone });
    const jaRecuperado = await col.findOne({
      accountId,
      recoveredAt: { $ne: null },
      $or: customerOr,
      productName: { $regex: `^${escapeRegex(product)}$`, $options: "i" },
    });
    if (jaRecuperado) return;
  }

  const doc: AbandonedCheckout = {
    accountId,
    checkoutEventId: "",
    platform: "n8n",
    platformCheckoutId:
      saleId ?? `affrec:${email ?? phone ?? ""}:${product ?? ""}`,
    recoveryType: "abandoned",
    customerEmail: normalized.customerEmail ?? null,
    customerPhone: normalized.customerPhone ?? null,
    productId: normalized.productId ?? null,
    productName: normalized.productName ?? null,
    affiliate: normalized.affiliate ?? null,
    amount: normalized.amount ?? null,
    currency: normalized.currency ?? null,
    fees: normalized.fees ?? null,
    recoveredAt: now,
    paidAt: now,
    recoveredAmount: normalized.amount ?? null,
    recoveredCurrency: normalized.currency ?? null,
    recoveredFees: normalized.fees ?? null,
    recoveredAffiliate: normalized.affiliate ?? null,
    commissionPaidKiwify: true,
    createdAt: now,
  };
  await col.insertOne(doc as AbandonedCheckout & { _id?: unknown });
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
