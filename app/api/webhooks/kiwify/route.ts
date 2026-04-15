import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { normalizeKiwifyPayloadWithStarted } from "@/lib/webhooks/normalize";
import { processIncomingEvent } from "@/lib/webhooks/process-event";

export async function POST(request: Request) {
  try {
    const id = getClientIdentifier(request);
    const limit = checkRateLimit(`kiwify:${id}`);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Muitas requisições" },
        { status: 429, headers: limit.retryAfter ? { "Retry-After": String(limit.retryAfter) } : undefined }
      );
    }
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return NextResponse.json(
        { error: "Token de webhook ausente" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const normalized = normalizeKiwifyPayloadWithStarted(body);
    if (!normalized) {
      return NextResponse.json(
        { received: true, message: "Evento não mapeado" },
        { status: 200 }
      );
    }

    const integrationsCol = await getCollection("integrations");
    const allIntegrations = await integrationsCol
      .find({ platform: "kiwify", active: true })
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

    await processIncomingEvent(
      integration.accountId,
      "kiwify",
      normalized
    );

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[webhook kiwify]", e);
    return NextResponse.json(
      { error: "Erro ao processar webhook" },
      { status: 500 }
    );
  }
}
