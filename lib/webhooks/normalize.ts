/**
 * Tipos de eventos normalizados (spec da LoopSale).
 */
export type NormalizedEventType =
  | "checkout_iniciado"
  | "checkout_abandonado"
  | "pagamento_aprovado"
  | "pagamento_recusado"
  | "pedido_cancelado"
  | "reembolso"
  | "whatsapp_status"
  | "whatsapp_enviado";

export interface NormalizedCheckoutEvent {
  eventType: NormalizedEventType;
  platformCheckoutId?: string;
  platformOrderId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  affiliate?: string;
  productId?: string;
  productName?: string;
  amount?: string;
  /** Moeda da venda (ex: BRL, USD). */
  currency?: string;
  /** Taxas da venda (na moeda da venda). */
  fees?: string;
  payload: Record<string, unknown>;
}

/**
 * Mapeia eventos Kiwify para o formato normalizado.
 * Ref: https://docs.kiwify.com.br/ - carrinho_abandonado, compra_aprovada, compra_recusada, compra_reembolsada, etc.
 */
export function normalizeKiwifyPayload(
  body: Record<string, unknown>
): NormalizedCheckoutEvent | null {
  const event = body.event as string | undefined;
  if (!event) return null;

  const mapping: Record<string, NormalizedEventType> = {
    carrinho_abandonado: "checkout_abandonado",
    compra_aprovada: "pagamento_aprovado",
    compra_recusada: "pagamento_recusado",
    compra_reembolsada: "reembolso",
    chargeback: "pedido_cancelado",
    whatsapp_status: "whatsapp_status",
  };

  const eventType = mapping[event] ?? null;
  if (!eventType) return null;

  const data = (body.data ?? body) as Record<string, unknown>;
  const order = (data.order ?? data) as Record<string, unknown>;
  const customer = (order.customer ?? data.customer ?? {}) as Record<string, unknown>;
  const product = (order.product ?? data.product ?? {}) as Record<string, unknown>;

  return {
    eventType,
    platformCheckoutId: String(data.checkout_id ?? data.id ?? order.checkout_id ?? "").trim() || undefined,
    platformOrderId: String(order.id ?? data.order_id ?? "").trim() || undefined,
    customerEmail: String(customer.email ?? order.email ?? "").trim() || undefined,
    customerPhone: String(customer.phone ?? customer.phone_number ?? order.phone ?? "").trim() || undefined,
    customerName: String(customer.name ?? customer.full_name ?? order.name ?? "").trim() || undefined,
    productId: String(product.id ?? data.product_id ?? "").trim() || undefined,
    productName: String(product.name ?? product.title ?? "").trim() || undefined,
    amount: String(order.value ?? data.value ?? order.amount ?? "").trim() || undefined,
    payload: body,
  };
}

/**
 * Kiwify também pode enviar "checkout iniciado" - depende do trigger. Se não houver trigger específico, consideramos compra_aprovada como conversão.
 * Para checkout_iniciado, algumas plataformas enviam quando o carrinho é criado; Kiwify pode usar carrinho_abandonado após tempo.
 * Adicionamos suporte a um evento genérico "checkout_started" se a doc mencionar.
 */
export function normalizeKiwifyPayloadWithStarted(
  body: Record<string, unknown>
): NormalizedCheckoutEvent | null {
  const normalized = normalizeKiwifyPayload(body);
  if (normalized) return normalized;
  const event = body.event as string | undefined;
  if (event === "checkout_started" || event === "checkout_iniciado") {
    const data = (body.data ?? body) as Record<string, unknown>;
    const order = (data.order ?? data) as Record<string, unknown>;
    const customer = (order.customer ?? data.customer ?? {}) as Record<string, unknown>;
    const product = (order.product ?? data.product ?? {}) as Record<string, unknown>;
    return {
      eventType: "checkout_iniciado",
      platformCheckoutId: String(data.checkout_id ?? data.id ?? "").trim() || undefined,
      platformOrderId: String(order.id ?? "").trim() || undefined,
      customerEmail: String(customer.email ?? order.email ?? "").trim() || undefined,
      customerPhone: String(customer.phone ?? order.phone ?? "").trim() || undefined,
      productId: String(product.id ?? "").trim() || undefined,
      productName: String(product.name ?? "").trim() || undefined,
      amount: String(order.value ?? order.amount ?? "").trim() || undefined,
      payload: body,
    };
  }
  return null;
}

/**
 * Mapeia o payload enviado por um fluxo do n8n para o formato normalizado.
 *
 * Contrato esperado (campos tolerantes a variações de nome):
 * {
 *   "event": "checkout_iniciado" | "checkout_abandonado" | "pagamento_aprovado"
 *            | "pagamento_recusado" | "pedido_cancelado" | "reembolso",
 *   "checkoutId": "abc123",        // ou checkout_id / cartId / cart_id / id
 *   "orderId": "ped_1",            // ou order_id / transactionId / transaction_id
 *   "email": "cliente@x.com",      // ou customerEmail / customer_email
 *   "phone": "5511999999999",      // ou customerPhone / customer_phone / whatsapp
 *   "productId": "p1",             // ou product_id
 *   "productName": "Curso X",      // ou product_name / product
 *   "amount": "197.00"             // ou value / price / total
 * }
 */
export function normalizeN8nPayload(
  input: Record<string, unknown>
): NormalizedCheckoutEvent | null {
  let body: Record<string, unknown> = input;

  // n8n pode enviar como array de itens — usa o primeiro.
  const raw = input as unknown;
  if (Array.isArray(raw)) {
    body = (raw[0] ?? {}) as Record<string, unknown>;
  }

  // Desembrulha wrappers comuns do n8n (body/data/json/payload) quando o
  // conteúdo real do evento está aninhado.
  for (const key of ["body", "data", "json", "payload"]) {
    const inner = body[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      const innerObj = inner as Record<string, unknown>;
      if (
        innerObj.event !== undefined ||
        innerObj.eventType !== undefined ||
        innerObj.type !== undefined ||
        innerObj.status !== undefined
      ) {
        body = innerObj;
        break;
      }
    }
  }

  const rawEvent = String(
    body.event ?? body.eventType ?? body.type ?? body.status ?? ""
  )
    .toLowerCase()
    .trim();
  if (!rawEvent) return null;

  const mapping: Record<string, NormalizedEventType> = {
    checkout_iniciado: "checkout_iniciado",
    checkout_started: "checkout_iniciado",
    carrinho_iniciado: "checkout_iniciado",
    cart_started: "checkout_iniciado",
    checkout_abandonado: "checkout_abandonado",
    carrinho_abandonado: "checkout_abandonado",
    cart_abandoned: "checkout_abandonado",
    abandoned: "checkout_abandonado",
    pagamento_aprovado: "pagamento_aprovado",
    compra_aprovada: "pagamento_aprovado",
    payment_approved: "pagamento_aprovado",
    approved: "pagamento_aprovado",
    paid: "pagamento_aprovado",
    pago: "pagamento_aprovado",
    aprovado: "pagamento_aprovado",
    venda: "pagamento_aprovado",
    sale: "pagamento_aprovado",
    pagamento_recusado: "pagamento_recusado",
    payment_refused: "pagamento_recusado",
    refused: "pagamento_recusado",
    pedido_cancelado: "pedido_cancelado",
    canceled: "pedido_cancelado",
    cancelled: "pedido_cancelado",
    reembolso: "reembolso",
    refund: "reembolso",
    refunded: "reembolso",
    whatsapp_enviado: "whatsapp_enviado",
    whatsapp_sent: "whatsapp_enviado",
    mensagem_enviada: "whatsapp_enviado",
    message_sent: "whatsapp_enviado",
    whatsapp: "whatsapp_enviado",
    whatsapp_status: "whatsapp_status",
  };
  const eventType = mapping[rawEvent];
  if (!eventType) return null;

  const asObject = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};

  // Objetos aninhados comuns (Kiwify/Hotmart/etc.).
  const customer = {
    ...asObject(body.buyer),
    ...asObject(body.customer),
    ...asObject(body.Customer),
  };
  const product = {
    ...asObject(body.Product),
    ...asObject(typeof body.product === "object" ? body.product : undefined),
  };

  // Procura a chave no nível principal e depois nos objetos aninhados,
  // ignorando valores que sejam objetos (evita "[object Object]").
  const pickFrom = (
    sources: Record<string, unknown>[],
    ...keys: string[]
  ): string | undefined => {
    for (const src of sources) {
      for (const k of keys) {
        const v = src[k];
        if (
          v !== undefined &&
          v !== null &&
          typeof v !== "object" &&
          String(v).trim() !== ""
        ) {
          return String(v).trim();
        }
      }
    }
    return undefined;
  };
  const pick = (...keys: string[]) => pickFrom([body, customer], ...keys);

  return {
    eventType,
    platformCheckoutId: pick("checkoutId", "checkout_id", "cartId", "cart_id", "id"),
    platformOrderId: pick("orderId", "order_id", "transactionId", "transaction_id"),
    customerEmail: pick("email", "customerEmail", "customer_email", "mail"),
    customerPhone: pick(
      "phone",
      "customerPhone",
      "customer_phone",
      "whatsapp",
      "mobile"
    ),
    customerName: pick(
      "name",
      "customerName",
      "customer_name",
      "nome",
      "fullName",
      "full_name",
      "first_name",
      "firstName"
    ),
    affiliate: pick(
      "afiliado",
      "affiliate",
      "affiliateName",
      "affiliate_name",
      "nome_afiliado",
      "affiliate_id",
      "affiliateId"
    ),
    productId: pick("productId", "product_id"),
    productName:
      pickFrom([body], "productName", "product_name", "product", "offer_name") ??
      pickFrom([product], "product_name", "name", "title"),
    amount:
      pickFrom(
        [body],
        "valorLiquido",
        "valor_liquido",
        "netAmount",
        "net_amount",
        "amount",
        "value",
        "price",
        "total"
      ) ?? pickFrom([product], "price", "value"),
    currency: pick("currency", "moeda"),
    fees: pick("taxas", "fees", "taxa"),
    payload: body,
  };
}

/**
 * Mapeia eventos Hotmart para o formato normalizado.
 * Ref: Hotmart postback - purchase.approved, purchase.refunded, etc.
 */
export function normalizeHotmartPayload(
  body: Record<string, unknown>
): NormalizedCheckoutEvent | null {
  const data = body.data ?? body;
  const event = (body.event ?? (data as Record<string, unknown>).event ?? (data as Record<string, unknown>).status) as string | undefined;
  if (!event) return null;

  const eventLower = String(event).toLowerCase();
  const mapping: Record<string, NormalizedEventType> = {
    "purchase.approved": "pagamento_aprovado",
    "purchase.completed": "pagamento_aprovado",
    "purchase.refunded": "reembolso",
    "purchase.canceled": "pedido_cancelado",
    "purchase.refund_requested": "reembolso",
    "purchase.chargeback": "pedido_cancelado",
    "purchase.expired": "pedido_cancelado",
    "cart.abandoned": "checkout_abandonado",
  };
  let eventType: NormalizedEventType | undefined = mapping[event] ?? mapping[eventLower];
  if (!eventType && eventLower.includes("approved")) eventType = "pagamento_aprovado";
  if (!eventType && eventLower.includes("refund")) eventType = "reembolso";
  if (!eventType && eventLower.includes("abandon")) eventType = "checkout_abandonado";
  if (!eventType) return null;

  const purchase = (data as Record<string, unknown>).purchase ?? data;
  const p = purchase as Record<string, unknown>;
  const buyer = (p.buyer ?? (data as Record<string, unknown>).buyer ?? {}) as Record<string, unknown>;
  const product = (p.product ?? (data as Record<string, unknown>).product ?? {}) as Record<string, unknown>;

  return {
    eventType,
    platformCheckoutId: String(p.transaction ?? p.id ?? (data as Record<string, unknown>).transaction ?? "").trim() || undefined,
    platformOrderId: String(p.transaction ?? p.order_id ?? "").trim() || undefined,
    customerEmail: String(buyer.email ?? p.buyer_email ?? "").trim() || undefined,
    customerPhone: String(buyer.phone ?? buyer.phone_number ?? "").trim() || undefined,
    customerName: String(buyer.name ?? buyer.full_name ?? "").trim() || undefined,
    productId: String(product.id ?? p.product_id ?? "").trim() || undefined,
    productName: String(product.name ?? product.title ?? "").trim() || undefined,
    amount: String(p.price ?? p.value ?? "").trim() || undefined,
    payload: body,
  };
}

/**
 * Hotmart "purchase in progress" ou similar como checkout_iniciado (quando houver).
 */
export function normalizeHotmartPayloadWithStarted(
  body: Record<string, unknown>
): NormalizedCheckoutEvent | null {
  const normalized = normalizeHotmartPayload(body);
  if (normalized) return normalized;
  const data = body.data ?? body;
  const event = String((data as Record<string, unknown>).event ?? (data as Record<string, unknown>).status ?? "").toLowerCase();
  if (event.includes("started") || event.includes("iniciado") || event === "purchase.pending" || event === "awaiting_payment") {
    const purchase = (data as Record<string, unknown>).purchase ?? data;
    const p = purchase as Record<string, unknown>;
    const buyer = (p?.buyer ?? {}) as Record<string, unknown>;
    const product = (p?.product ?? {}) as Record<string, unknown>;
    return {
      eventType: "checkout_iniciado",
      platformCheckoutId: String(p?.transaction ?? p?.id ?? "").trim() || undefined,
      platformOrderId: String(p?.transaction ?? "").trim() || undefined,
      customerEmail: String(buyer.email ?? p?.buyer_email ?? "").trim() || undefined,
      customerPhone: String(buyer.phone ?? "").trim() || undefined,
      productId: String(product?.id ?? p?.product_id ?? "").trim() || undefined,
      productName: String(product?.name ?? "").trim() || undefined,
      amount: String(p?.price ?? "").trim() || undefined,
      payload: body,
    };
  }
  return null;
}
