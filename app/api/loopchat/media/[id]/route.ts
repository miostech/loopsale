import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { chatContext } from "@/lib/loopchat/access";
import { resolveSendToken } from "@/lib/whatsapp/central-config";
import { findChannel, channelSendConfig } from "@/lib/whatsapp/channels";

const GRAPH = "https://graph.facebook.com";
function version(): string {
  return process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0";
}

/**
 * Proxy de mídia do WhatsApp: recebe o mediaId, busca a URL temporária na Meta
 * (com o token da conta), baixa o binário e devolve para o front. Necessário
 * porque a URL da Meta é curta e exige o token — não dá para servir direto.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    return NextResponse.json({ error: "Indisponível." }, { status: 404 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Mídia inválida." }, { status: 400 });

  // Segurança: a mídia precisa pertencer a uma mensagem desta conta.
  const waCol = await getCollection("whatsappMessages");
  const msg = (await waCol.findOne({
    accountId: ctx.accountId,
    mediaId: id,
  })) as { mimeType?: string | null; phoneNumberId?: string | null } | null;
  if (!msg) {
    return NextResponse.json({ error: "Mídia não encontrada." }, { status: 404 });
  }

  // Usa o token do canal (número) daquela mensagem; cai no legado se preciso.
  const canal = findChannel(ctx.account, msg.phoneNumberId ?? null);
  const token =
    (await resolveSendToken(channelSendConfig(canal))) ??
    (await resolveSendToken(ctx.account?.whatsapp));
  if (!token) {
    return NextResponse.json({ error: "Conta sem WhatsApp." }, { status: 400 });
  }

  try {
    // 1) URL temporária da mídia.
    const infoRes = await fetch(`${GRAPH}/${version()}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!infoRes.ok) {
      return NextResponse.json({ error: "Mídia indisponível." }, { status: 502 });
    }
    const info = (await infoRes.json()) as { url?: string; mime_type?: string };
    if (!info.url) {
      return NextResponse.json({ error: "Mídia sem URL." }, { status: 502 });
    }
    // 2) Baixa o binário (a URL da Meta exige o token no header).
    const binRes = await fetch(info.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!binRes.ok) {
      return NextResponse.json({ error: "Falha ao baixar mídia." }, { status: 502 });
    }
    const buf = await binRes.arrayBuffer();
    const mime = info.mime_type || msg.mimeType || "application/octet-stream";
    return new Response(buf, {
      headers: {
        "Content-Type": mime,
        // Mídia não muda; cacheia no navegador do próprio usuário.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar mídia." }, { status: 502 });
  }
}
