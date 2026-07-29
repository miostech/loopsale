import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { WhatsAppMessage } from "@/lib/db/types";
import { chatContext, janelaAberta } from "@/lib/loopchat/access";
import { normalizePhone, sendText, tokenFor, SEM_TOKEN } from "@/lib/whatsapp/cloud";

/** Resposta manual do cliente (ou da equipe dele) numa conversa. */
export async function POST(request: Request) {
  const ctx = await chatContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (ctx.access !== "available") {
    return NextResponse.json(
      {
        error:
          ctx.access === "hidden"
            ? "Com atendimento gerenciado, quem responde é a LoopSale."
            : "LoopChat não contratado.",
      },
      { status: ctx.access === "hidden" ? 403 : 402 }
    );
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível no modo demo." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const contact = normalizePhone(String(body.contact ?? ""));
  const texto = String(body.body ?? "").trim();
  if (!contact || !texto) {
    return NextResponse.json(
      { error: "Informe o contato e a mensagem." },
      { status: 400 }
    );
  }

  const token = tokenFor(
    ctx.account?.whatsapp?.accessToken,
    ctx.account?.whatsapp?.source
  );
  const phoneNumberId = ctx.account?.whatsapp?.phoneNumberId ?? "";
  if (!token) {
    return NextResponse.json({ error: SEM_TOKEN }, { status: 400 });
  }

  // Texto livre só vale dentro da janela de 24h da Meta. Fora dela, o envio
  // seria recusado pela API — melhor recusar aqui, com o motivo certo.
  const waCol = await getCollection("whatsappMessages");
  const ultima = (await waCol
    .find({ accountId: ctx.accountId, contact, direction: "in" })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as { createdAt?: Date }[];
  if (!janelaAberta(ultima[0]?.createdAt)) {
    return NextResponse.json(
      {
        error:
          "A janela de 24h desta conversa fechou. Só é possível retomar com um template aprovado pela Meta.",
      },
      { status: 409 }
    );
  }

  const result = await sendText({ phoneNumberId, to: contact, body: texto, token });
  const now = new Date();
  const doc: WhatsAppMessage = {
    accountId: ctx.accountId,
    direction: "out",
    wamid: result.wamid ?? null,
    phoneNumberId,
    contact,
    type: "text",
    body: texto,
    status: result.success ? "accepted" : "failed",
    error: result.error ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await waCol.insertOne(doc as WhatsAppMessage & { _id?: unknown });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Não foi possível enviar." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
