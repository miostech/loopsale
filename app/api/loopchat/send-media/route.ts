import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { WhatsAppMessage } from "@/lib/db/types";
import { chatContext, janelaAberta } from "@/lib/loopchat/access";
import { isDemoContext } from "@/lib/loopchat/demo";
import {
  soDigitos,
  uploadMedia,
  sendMedia,
  mediaKindFromMime,
  SEM_TOKEN,
} from "@/lib/whatsapp/cloud";
import { resolveSendToken } from "@/lib/whatsapp/central-config";
import { findChannel, channelSendConfig } from "@/lib/whatsapp/channels";
import { resolveChatAccount } from "@/lib/loopchat/access";

// Limite de tamanho (a Meta aceita até ~100MB p/ doc, mas seguramos em 16MB
// pra caber imagem/vídeo/áudio sem estourar memória do handler).
const MAX_BYTES = 16 * 1024 * 1024;

/** Envia um anexo (imagem/vídeo/áudio/documento) numa conversa aberta. */
export async function POST(request: Request) {
  const ctx = await chatContext();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ctx.isAdmin && ctx.access !== "available") {
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
  if (isDemoContext(ctx)) return NextResponse.json({ ok: true });
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível no modo demo." }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }
  const contact = soDigitos(String(form.get("contact") ?? ""));
  const channel = String(form.get("channel") ?? "") || null;
  const caption = String(form.get("caption") ?? "").trim();
  const file = form.get("file");
  if (!contact || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Informe o contato e o arquivo." },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Arquivo muito grande (máximo 16 MB)." },
      { status: 413 }
    );
  }

  // Conta alvo: admin envia pela empresa dona do número.
  const alvo = await resolveChatAccount(ctx, channel);
  // Envia pelo canal (caixa) da conversa.
  const canal = findChannel(alvo.account, channel);
  const token = await resolveSendToken(channelSendConfig(canal));
  const phoneNumberId = canal?.phoneNumberId ?? "";
  if (!token || !phoneNumberId) {
    return NextResponse.json({ error: SEM_TOKEN }, { status: 400 });
  }

  // Mídia livre também só vale dentro da janela de 24h da Meta.
  const waCol = await getCollection("whatsappMessages");
  const ultima = (await waCol
    .find({ accountId: alvo.accountId, contact, phoneNumberId, direction: "in" })
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

  const mimeType = file.type || "application/octet-stream";
  const kind = mediaKindFromMime(mimeType);
  const filename = file.name || "arquivo";
  const bytes = await file.arrayBuffer();

  // 1) Sobe pra Meta → media id. 2) Envia a mensagem com esse id.
  const up = await uploadMedia({ phoneNumberId, bytes, mimeType, filename, token });
  if (!up.id) {
    return NextResponse.json(
      { error: up.error ?? "Não foi possível subir o arquivo." },
      { status: 502 }
    );
  }
  const result = await sendMedia({
    phoneNumberId,
    to: contact,
    kind,
    mediaId: up.id,
    caption,
    filename: kind === "document" ? filename : null,
    token,
  });

  const now = new Date();
  const doc: WhatsAppMessage = {
    accountId: alvo.accountId,
    direction: "out",
    wamid: result.wamid ?? null,
    phoneNumberId,
    contact,
    type: kind,
    body: caption || null,
    mediaId: up.id,
    mimeType,
    status: result.success ? "accepted" : "failed",
    error: result.error ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await waCol.insertOne(doc as WhatsAppMessage & { _id?: unknown });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Não foi possível enviar o anexo." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
