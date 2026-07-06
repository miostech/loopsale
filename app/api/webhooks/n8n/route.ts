import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { normalizeN8nPayload } from "@/lib/webhooks/normalize";
import { processIncomingEvent } from "@/lib/webhooks/process-event";

export async function POST(request: Request) {
  try {
    const id = getClientIdentifier(request);
    const limit = checkRateLimit(`n8n:${id}`);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Muitas requisições" },
        {
          status: 429,
          headers: limit.retryAfter
            ? { "Retry-After": String(limit.retryAfter) }
            : undefined,
        }
      );
    }

    const url = new URL(request.url);
    const token =
      url.searchParams.get("token") ?? request.headers.get("x-webhook-token");
    if (!token) {
      return NextResponse.json(
        { error: "Token de webhook ausente" },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const normalized = normalizeN8nPayload(body);
    if (!normalized) {
      return NextResponse.json(
        {
          received: true,
          message:
            "Evento não mapeado. Envie um campo 'event' com um tipo suportado.",
        },
        { status: 200 }
      );
    }

    const integrationsCol = await getCollection("integrations");
    const allIntegrations = await integrationsCol
      .find({ platform: "n8n", active: true })
      .toArray();
    const integration = allIntegrations.find(
      (i) => (i.config as Record<string, unknown>)?.webhookToken === token
    );

    if (!integration) {
      return NextResponse.json(
        { error: "Integração não encontrada ou token inválido" },
        { status: 404 }
      );
    }

    await processIncomingEvent(integration.accountId, "n8n", normalized);

    return NextResponse.json({ received: true, eventType: normalized.eventType });
  } catch (e) {
    console.error("[webhook n8n]", e);
    return NextResponse.json(
      { error: "Erro ao processar webhook" },
      { status: 500 }
    );
  }
}
