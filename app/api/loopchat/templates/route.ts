import { NextResponse } from "next/server";
import { isDatabaseDisabled } from "@/lib/db";
import { chatContext } from "@/lib/loopchat/access";
import { isDemoContext, demoTemplates } from "@/lib/loopchat/demo";
import { listTemplates, usesCentralWaba } from "@/lib/whatsapp/cloud";
import { resolveSendToken, getCentralWabaId } from "@/lib/whatsapp/central-config";
import { findChannel, channelSendConfig } from "@/lib/whatsapp/channels";

/**
 * Templates aprovados da WABA da conta, para iniciar uma conversa nova.
 * Só APPROVED entra: são os únicos que a Meta aceita enviar fora da janela.
 */
export async function GET(request: Request) {
  const ctx = await chatContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (ctx.access !== "available") {
    return NextResponse.json(
      { error: "LoopChat indisponível para esta conta." },
      { status: ctx.access === "hidden" ? 403 : 402 }
    );
  }
  if (isDemoContext(ctx)) {
    return NextResponse.json({ templates: demoTemplates(), connected: true });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ templates: [], connected: false });
  }

  // Token e WABA seguem a origem do canal escolhido: própria (token + wabaId do
  // canal) ou central legada (token + WABA do ambiente).
  const channel = new URL(request.url).searchParams.get("channel") || null;
  const canal = findChannel(ctx.account, channel);
  const token = await resolveSendToken(channelSendConfig(canal));
  const wabaId = usesCentralWaba(canal?.source)
    ? await getCentralWabaId()
    : canal?.wabaId ?? "";
  if (!token || !wabaId) {
    return NextResponse.json({ templates: [], connected: false });
  }

  try {
    const todos = await listTemplates(wabaId, token);
    const templates = todos
      .filter((t) => t.status.toUpperCase() === "APPROVED")
      .map((t) => ({
        name: t.name,
        language: t.language,
        body: t.body,
        variableCount: t.variableCount,
      }));
    return NextResponse.json({ templates, connected: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar templates.";
    return NextResponse.json({ templates: [], connected: true, error: msg });
  }
}
