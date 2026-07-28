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

/** Normaliza para dígitos E.164 sem "+". Assume Brasil se vier sem DDI. */
export function normalizePhone(raw: string): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (!d.startsWith("55") && d.length <= 11) d = "55" + d;
  return d;
}

async function graphPost(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${GRAPH}/${version()}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
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
}): Promise<SendResult> {
  if (!whatsappConfigured()) {
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
    const data = await graphPost(`${params.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to: normalizePhone(params.to),
      type: "template",
      template: {
        name: params.templateName,
        language: { code: params.language ?? "pt_BR" },
        ...(components ? { components } : {}),
      },
    });
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
}): Promise<SendResult> {
  if (!whatsappConfigured()) {
    return { success: false, error: "WhatsApp Cloud API não configurado." };
  }
  if (!params.phoneNumberId) {
    return { success: false, error: "Conta sem Phone Number ID do WhatsApp." };
  }
  try {
    const data = await graphPost(`${params.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to: normalizePhone(params.to),
      type: "text",
      text: { body: params.body, preview_url: true },
    });
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
