import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { WhatsAppMessage } from "@/lib/db/types";
import { chatContext } from "@/lib/loopchat/access";
import { isDemoContext } from "@/lib/loopchat/demo";
import { normalizePhone } from "@/lib/whatsapp/cloud";

/**
 * Nota interna: fica no histórico da conversa, visível só para a equipe.
 * Não passa pela Meta, então não depende de token nem da janela de 24h.
 */
export async function POST(request: Request) {
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
  if (isDemoContext(ctx)) return NextResponse.json({ ok: true });
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível no modo demo." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const contact = normalizePhone(String(body.contact ?? ""));
  const texto = String(body.body ?? "").trim();
  if (!contact || !texto) {
    return NextResponse.json(
      { error: "Informe o contato e a nota." },
      { status: 400 }
    );
  }

  const now = new Date();
  const doc: WhatsAppMessage = {
    accountId: ctx.accountId,
    direction: "out",
    internal: true,
    authorName: ctx.email ?? null,
    wamid: null,
    phoneNumberId: ctx.account?.whatsapp?.phoneNumberId ?? null,
    contact,
    type: "note",
    body: texto,
    status: null,
    createdAt: now,
    updatedAt: now,
  };
  const waCol = await getCollection("whatsappMessages");
  await waCol.insertOne(doc as WhatsAppMessage & { _id?: unknown });

  return NextResponse.json({ ok: true });
}
