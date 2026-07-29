import { NextResponse } from "next/server";
import { isDatabaseDisabled } from "@/lib/db";
import { chatContext } from "@/lib/loopchat/access";
import { listTemplates } from "@/lib/whatsapp/cloud";

/**
 * Templates aprovados da WABA da conta, para iniciar uma conversa nova.
 * Só APPROVED entra: são os únicos que a Meta aceita enviar fora da janela.
 */
export async function GET() {
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
  if (isDatabaseDisabled()) {
    return NextResponse.json({ templates: [], connected: false });
  }

  const wa = ctx.account?.whatsapp ?? null;
  if (!wa?.wabaId || !wa?.accessToken) {
    return NextResponse.json({ templates: [], connected: false });
  }

  try {
    const todos = await listTemplates(wa.wabaId, wa.accessToken);
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
