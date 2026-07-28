import crypto from "crypto";

/**
 * WhatsApp Cloud API (Meta) — WABA central da LoopSale.
 * O token de acesso é único (system user), no ambiente. Cada cliente tem um
 * Phone Number ID próprio, guardado em account.whatsapp.phoneNumberId.
 */

const GRAPH = "https://graph.facebook.com";

function version(): string {
  return process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0";
}
function accessToken(): string {
  return process.env.WHATSAPP_ACCESS_TOKEN ?? "";
}

export function whatsappConfigured(): boolean {
  return !!process.env.WHATSAPP_ACCESS_TOKEN;
}

/** true se dá pra enviar por esta conta: token próprio (Embedded Signup) ou central. */
export function canSendFor(accountToken?: string | null): boolean {
  return !!accountToken || whatsappConfigured();
}

/** Normaliza para dígitos E.164 sem "+". Assume Brasil se vier sem DDI. */
export function normalizePhone(raw: string): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (!d.startsWith("55") && d.length <= 11) d = "55" + d;
  return d;
}

async function graphPost(
  path: string,
  body: Record<string, unknown>,
  token?: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${GRAPH}/${version()}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token ?? accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (data?.error as { message?: string } | undefined)?.message ??
      "Erro na Graph API do WhatsApp";
    throw new Error(msg);
  }
  return data;
}

async function graphGet(
  path: string,
  token: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${GRAPH}/${version()}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (data?.error as { message?: string } | undefined)?.message ??
      "Erro na Graph API do WhatsApp";
    throw new Error(msg);
  }
  return data;
}

/**
 * Troca o `code` do Embedded Signup por um token de acesso (server-side).
 * Usa o App ID + App Secret do app Meta da LoopSale.
 */
export async function exchangeCode(code: string): Promise<string> {
  const appId = process.env.FACEBOOK_APP_ID ?? process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("FACEBOOK_APP_ID / WHATSAPP_APP_SECRET não configurados.");
  }
  const url =
    `${GRAPH}/${version()}/oauth/access_token` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&code=${encodeURIComponent(code)}`;
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? "Falha ao trocar o code por token.");
  }
  return data.access_token;
}

/** WABA central da LoopSale (env). Usada na tela de review da Meta. */
export function centralWabaId(): string {
  return process.env.WHATSAPP_WABA_ID ?? "";
}
export function centralToken(): string {
  return process.env.WHATSAPP_ACCESS_TOKEN ?? "";
}

/** Cria um template simples (UTILITY, só corpo). Retorna o id/status. */
export async function createTemplate(params: {
  wabaId: string;
  token: string;
  name: string;
  language?: string;
  category?: string;
  body: string;
}): Promise<{ id?: string; status?: string }> {
  const data = await graphPost(
    `${params.wabaId}/message_templates`,
    {
      name: params.name,
      language: params.language ?? "pt_BR",
      category: params.category ?? "UTILITY",
      components: [{ type: "BODY", text: params.body }],
    },
    params.token
  );
  return { id: data.id as string, status: data.status as string };
}

/** Assina o app da LoopSale aos webhooks da WABA do cliente. */
export async function subscribeAppToWaba(
  wabaId: string,
  token: string
): Promise<void> {
  await graphPost(`${wabaId}/subscribed_apps`, {}, token);
}

/** Nome/info da WABA. */
export async function getWabaInfo(
  wabaId: string,
  token: string
): Promise<{ name: string }> {
  const data = await graphGet(`${wabaId}?fields=name`, token);
  return { name: String(data.name ?? "") };
}

/** Números de telefone de uma WABA. */
export async function getPhoneNumbers(
  wabaId: string,
  token: string
): Promise<
  { id: string; displayPhoneNumber: string; verifiedName?: string }[]
> {
  const data = await graphGet(
    `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
    token
  );
  const rows = (data.data as Record<string, unknown>[]) ?? [];
  return rows.map((r) => ({
    id: String(r.id),
    displayPhoneNumber: String(r.display_phone_number ?? ""),
    verifiedName: (r.verified_name as string) ?? undefined,
  }));
}

/** Lista os templates da WABA com status. */
export async function listTemplates(
  wabaId: string,
  token: string
): Promise<
  { name: string; status: string; language: string; category: string }[]
> {
  const data = await graphGet(
    `${wabaId}/message_templates?fields=name,status,language,category&limit=100`,
    token
  );
  const rows = (data.data as Record<string, unknown>[]) ?? [];
  return rows.map((r) => ({
    name: String(r.name ?? ""),
    status: String(r.status ?? ""),
    language: String(r.language ?? ""),
    category: String(r.category ?? ""),
  }));
}

function wamidOf(data: Record<string, unknown>): string | null {
  const messages = data.messages as { id?: string }[] | undefined;
  return messages?.[0]?.id ?? null;
}

export type SendResult = {
  success: boolean;
  wamid?: string | null;
  error?: string;
};

/**
 * Mensagem de template (business-initiated, fora da janela de 24h).
 * `variables` preenche os {{1}}, {{2}}... do corpo do template.
 */
export async function sendTemplate(params: {
  phoneNumberId: string;
  to: string;
  templateName: string;
  language?: string;
  variables?: string[];
  /** Token da conta (Embedded Signup). Se ausente, usa o central. */
  token?: string | null;
}): Promise<SendResult> {
  if (!canSendFor(params.token)) {
    return { success: false, error: "WhatsApp Cloud API não configurado." };
  }
  if (!params.phoneNumberId) {
    return { success: false, error: "Conta sem Phone Number ID do WhatsApp." };
  }
  try {
    const components =
      params.variables && params.variables.length
        ? [
            {
              type: "body",
              parameters: params.variables.map((v) => ({
                type: "text",
                text: v,
              })),
            },
          ]
        : undefined;
    const data = await graphPost(
      `${params.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: normalizePhone(params.to),
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.language ?? "pt_BR" },
          ...(components ? { components } : {}),
        },
      },
      params.token ?? undefined
    );
    return { success: true, wamid: wamidOf(data) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/**
 * Mensagem de texto livre (só dentro da janela de 24h após o cliente escrever).
 */
export async function sendText(params: {
  phoneNumberId: string;
  to: string;
  body: string;
  token?: string | null;
}): Promise<SendResult> {
  if (!canSendFor(params.token)) {
    return { success: false, error: "WhatsApp Cloud API não configurado." };
  }
  if (!params.phoneNumberId) {
    return { success: false, error: "Conta sem Phone Number ID do WhatsApp." };
  }
  try {
    const data = await graphPost(
      `${params.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: normalizePhone(params.to),
        type: "text",
        text: { body: params.body, preview_url: true },
      },
      params.token ?? undefined
    );
    return { success: true, wamid: wamidOf(data) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/**
 * Valida a assinatura X-Hub-Signature-256 do webhook da Meta.
 * Sem APP_SECRET configurado, não bloqueia (útil em dev).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true;
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader)
    );
  } catch {
    return false;
  }
}
