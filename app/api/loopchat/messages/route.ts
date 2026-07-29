import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { WhatsAppMessage } from "@/lib/db/types";
import { chatContext, janelaAberta } from "@/lib/loopchat/access";
import { normalizePhone } from "@/lib/whatsapp/cloud";

/** Histórico de uma conversa (um contato). */
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
  if (isDatabaseDisabled()) return NextResponse.json({ mensagens: [] });

  const contact = normalizePhone(
    new URL(request.url).searchParams.get("contact") ?? ""
  );
  if (!contact) {
    return NextResponse.json({ error: "Contato inválido." }, { status: 400 });
  }

  const waCol = await getCollection("whatsappMessages");
  const rows = (await waCol
    .find({ accountId: ctx.accountId, contact })
    .sort({ createdAt: 1 })
    .limit(300)
    .toArray()) as (WhatsAppMessage & { _id: unknown })[];

  // Nota interna não abre janela: só mensagem do cliente conta.
  const ultimaRecebida = [...rows]
    .reverse()
    .find((m) => m.direction === "in" && !m.internal)?.createdAt;

  return NextResponse.json({
    contact,
    janelaAberta: janelaAberta(ultimaRecebida),
    mensagens: rows.map((m) => ({
      id: String(m._id),
      direction: m.direction,
      internal: !!m.internal,
      authorName: m.authorName ?? null,
      body: m.body,
      type: m.type,
      templateName: m.templateName ?? null,
      status: m.status ?? null,
      error: m.error ?? null,
      createdAt: m.createdAt,
    })),
  });
}
