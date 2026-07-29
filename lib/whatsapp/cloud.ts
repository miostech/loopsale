import crypto from "crypto";

/**
 * WhatsApp Cloud API (Meta).
 *
 * Padrão para conta nova: WABA do próprio cliente, conectada pelo Embedded
 * Signup (LoopSale como Tech Provider). O token fica em
 * account.whatsapp.accessToken e é o cliente quem paga a Meta.
 *
 * A WABA central da LoopSale (WHATSAPP_ACCESS_TOKEN no ambiente) é legado: só
 * atende contas marcadas com whatsapp.source = "central". Sem essa marca, conta
 * sem token não envia — antes o código caía na central em silêncio, e o custo
 * das mensagens ia parar na LoopSale sem ninguém perceber.
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

/**
 * Origem do número da conta. Ausente = "own" (padrão para conta nova): o
 * cliente traz a própria WABA e paga a Meta. "central" é a marca explícita das
 * contas legadas que ainda usam a WABA da LoopSale.
 */
export type WhatsappSource = "own" | "central";

/** Motivo único de recusa, para o dashboard e os logs dizerem a mesma coisa. */
export const SEM_TOKEN =
  "Conta sem WhatsApp conectado: conclua o Embedded Signup em Integrações.";

/** true se a conta é atendida pela WABA central da LoopSale (legado). */
export function usesCentralWaba(source?: string | null): boolean {
  return source === "central";
}

/**
 * true se dá pra enviar por esta conta. Token próprio sempre vale; o token
 * central só para conta legada marcada como "central".
 */
export function canSendFor(
  accountToken?: string | null,
  source?: string | null
): boolean {
  if (accountToken) return true;
  return usesCentralWaba(source) && whatsappConfigured();
}

/**
 * Token que esta conta deve usar, ou null se ela não pode enviar. Resolver aqui
 * (e não no graphPost) mantém o uso da WABA central explícito em quem chama.
 */
export function tokenFor(
  accountToken?: string | null,
  source?: string | null
): string | null {
  if (accountToken) return accountToken;
  if (usesCentralWaba(source) && whatsappConfigured()) return accessToken();
  return null;
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

export type TemplateResumo = {
  name: string;
  status: string;
  language: string;
  category: string;
  /** Texto do componente BODY, com os {{1}}, {{2}}... ainda no lugar. */
  body: string;
  /** Quantas variáveis posicionais o corpo espera (maior {{n}}). */
  variableCount: number;
};

/** Maior índice {{n}} no texto — é quantas variáveis o corpo pede. */
function contarVariaveis(texto: string): number {
  let maior = 0;
  for (const m of texto.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    const n = Number(m[1]);
    if (n > maior) maior = n;
  }
  return maior;
}

/** Extrai o texto do componente BODY dos components do template. */
function corpoDoTemplate(components: unknown): string {
  const lista = Array.isArray(components)
    ? (components as Record<string, unknown>[])
    : [];
  const body = lista.find(
    (c) => String(c.type ?? "").toUpperCase() === "BODY"
  );
  return String(body?.text ?? "");
}

/** Lista os templates da WABA com status, corpo e nº de variáveis. */
export async function listTemplates(
  wabaId: string,
  token: string
): Promise<TemplateResumo[]> {
  const data = await graphGet(
    `${wabaId}/message_templates?fields=name,status,language,category,components&limit=100`,
    token
  );
  const rows = (data.data as Record<string, unknown>[]) ?? [];
  return rows.map((r) => {
    const body = corpoDoTemplate(r.components);
    return {
      name: String(r.name ?? ""),
      status: String(r.status ?? ""),
      language: String(r.language ?? ""),
      category: String(r.category ?? ""),
      body,
      variableCount: contarVariaveis(body),
    };
  });
}

/** Substitui {{1}}, {{2}}... pelos valores dados (para preview e histórico). */
export function preencherCorpo(body: string, variables: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_all, n) => {
    const idx = Number(n) - 1;
    return variables[idx] ?? `{{${n}}}`;
  });
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
  /** Token da conta, já resolvido por tokenFor(). Sem ele não envia. */
  token?: string | null;
}): Promise<SendResult> {
  if (!params.token) {
    return { success: false, error: SEM_TOKEN };
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
      params.token
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
  /** Token da conta, já resolvido por tokenFor(). Sem ele não envia. */
  token?: string | null;
}): Promise<SendResult> {
  if (!params.token) {
    return { success: false, error: SEM_TOKEN };
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
      params.token
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
