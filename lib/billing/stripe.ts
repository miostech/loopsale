import crypto from "crypto";

const STRIPE_API = "https://api.stripe.com/v1";

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

function key(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY não configurada.");
  return k;
}

async function stripePost(
  path: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (data?.error as { message?: string } | undefined)?.message ??
      "Erro na API do Stripe";
    throw new Error(msg);
  }
  return data;
}

async function stripeGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (data?.error as { message?: string } | undefined)?.message ??
      "Erro na API do Stripe";
    throw new Error(msg);
  }
  return data;
}

export async function createCustomer(params: {
  email: string;
  name?: string;
  accountId: string;
}): Promise<{ id: string }> {
  const doc = await stripePost("/customers", {
    email: params.email,
    name: params.name ?? "",
    "metadata[accountId]": params.accountId,
  });
  return { id: String(doc.id) };
}

export async function createCheckoutSession(params: {
  customer: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  accountId: string;
}): Promise<{ url: string }> {
  const doc = await stripePost("/checkout/sessions", {
    mode: "subscription",
    customer: params.customer,
    "line_items[0][price]": params.priceId,
    "line_items[0][quantity]": "1",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    "subscription_data[metadata][accountId]": params.accountId,
    allow_promotion_codes: "true",
  });
  return { url: String(doc.url) };
}

export async function createPortalSession(params: {
  customer: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const doc = await stripePost("/billing_portal/sessions", {
    customer: params.customer,
    return_url: params.returnUrl,
  });
  return { url: String(doc.url) };
}

export type StripeInvoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  created: number;
  pdf: string | null;
  hostedUrl: string | null;
};

export async function listInvoices(
  customer: string,
  limit = 12
): Promise<StripeInvoice[]> {
  const doc = await stripeGet(
    `/invoices?customer=${encodeURIComponent(customer)}&limit=${limit}`
  );
  const rows = (doc.data as Record<string, unknown>[]) ?? [];
  return rows.map((r) => ({
    id: String(r.id),
    number: (r.number as string) ?? null,
    status: (r.status as string) ?? null,
    amountPaid: Number(r.amount_paid ?? 0) / 100,
    currency: String(r.currency ?? "brl").toUpperCase(),
    created: Number(r.created ?? 0),
    pdf: (r.invoice_pdf as string) ?? null,
    hostedUrl: (r.hosted_invoice_url as string) ?? null,
  }));
}

export async function getSubscription(
  id: string
): Promise<Record<string, unknown>> {
  return stripeGet(`/subscriptions/${encodeURIComponent(id)}`);
}

/** Verifica a assinatura do webhook (Stripe-Signature: t=..,v1=..). */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string])
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(v1)
    );
  } catch {
    return false;
  }
}
