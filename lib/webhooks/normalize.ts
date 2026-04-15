/**
 * Tipos de eventos normalizados (spec da LoopSale).
 */
export type NormalizedEventType =
  | "checkout_iniciado"
  | "checkout_abandonado"
  | "pagamento_aprovado"
  | "pagamento_recusado"
  | "pedido_cancelado"
  | "reembolso";

export interface NormalizedCheckoutEvent {
  eventType: NormalizedEventType;
  platformCheckoutId?: string;
  platformOrderId?: string;
  customerEmail?: string;
  customerPhone?: string;
  productId?: string;
  productName?: string;
  amount?: string;
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
