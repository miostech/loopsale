import { NextResponse, after } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { verifyWebhookSignature, sendText } from "@/lib/whatsapp/cloud";
import { resolveSendToken } from "@/lib/whatsapp/central-config";
import {
  findChannel,
  channelSendConfig,
  conversationChannelKey,
} from "@/lib/whatsapp/channels";
import type { Account, WhatsAppMessage, Conversation } from "@/lib/db/types";
import { generateAttendantReply, type AttendantTurn } from "@/lib/ai/attendant";
import { enviarPush } from "@/lib/push";

/**
 * Webhook do WhatsApp Cloud API (Meta).
 * GET  = verificação do endpoint (hub.challenge).
 * POST = status de entrega (sent/delivered/read/failed) e mensagens recebidas.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: { title?: string; message?: string }[];
};
type WaMedia = {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
};
type WaMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: WaMedia;
  video?: WaMedia;
  audio?: WaMedia;
  document?: WaMedia;
  sticker?: WaMedia;
  reaction?: { message_id?: string; emoji?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };
  contacts?: {
    name?: { formatted_name?: string };
    phones?: { phone?: string }[];
  }[];
  timestamp?: string;
};
type WaValue = {
  metadata?: { phone_number_id?: string };
  statuses?: WaStatus[];
  messages?: WaMessage[];
  /** Perfil de quem enviou — traz o nome do WhatsApp do cliente. */
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
};

/** Texto que representa a mensagem no histórico, por tipo. */
function corpoDaMensagem(msg: WaMessage, caption?: string | null): string | null {
  if (msg.text?.body) return msg.text.body;
  if (caption) return caption;
  if (msg.reaction) {
    return msg.reaction.emoji ? `Reagiu ${msg.reaction.emoji}` : "Removeu a reação";
  }
  // Resposta de botão (quick-reply de template) ou mensagem interativa.
  if (msg.button?.text) return msg.button.text;
  if (msg.interactive) {
    const r = msg.interactive.button_reply ?? msg.interactive.list_reply;
    if (r?.title) return r.title;
  }
  if (msg.location) {
    const l = msg.location;
    const partes = ["📍 Localização"];
    if (l.name) partes.push(l.name);
    if (l.address) partes.push(l.address);
    if (l.latitude != null && l.longitude != null) {
      partes.push(`https://www.google.com/maps?q=${l.latitude},${l.longitude}`);
    }
    return partes.join("\n");
  }
  if (msg.contacts?.length) {
    return msg.contacts
      .map((c) => {
        const nome = c.name?.formatted_name ?? "Contato";
        const tels = (c.phones ?? [])
          .map((p) => p.phone)
          .filter(Boolean)
          .join(", ");
        return `👤 ${nome}${tels ? ` — ${tels}` : ""}`;
      })
      .join("\n");
  }
  return null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(raw, sig)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }
  // Sempre responde 200 rápido pra Meta não reenviar.
  if (isDatabaseDisabled()) return NextResponse.json({ received: true });

  let payload: {
    entry?: { changes?: { value?: WaValue }[] }[];
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ received: true });
  }

  // Conversas que receberam mensagem nova de texto e têm o robô ligado — o bot
  // responde depois de a Meta receber o 200 (via after), pra não travar o webhook.
  const paraResponder = new Map<
    string,
    { account: Account; contact: string; phoneNumberId: string | null }
  >();
  // Notificações push a enviar depois do 200 (uma por mensagem nova recebida).
  const paraNotificar: { accountId: string; title: string; body: string }[] = [];

  try {
    const accountsCol = await getCollection("accounts");
    const waCol = await getCollection("whatsappMessages");
    const eventsCol = await getCollection("checkoutEvents");
    const now = new Date();

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;
        const phoneNumberId = value.metadata?.phone_number_id ?? null;

        // Resolve a conta dona deste número — pode estar num canal (multi-caixa)
        // ou no whatsapp legado.
        const account = phoneNumberId
          ? await accountsCol.findOne({
              $or: [
                { "channels.phoneNumberId": phoneNumberId },
                { "whatsapp.phoneNumberId": phoneNumberId },
              ],
            })
          : null;
        const accountId = account?._id ? String(account._id) : null;
        // Nome do perfil de quem escreveu (o WhatsApp manda no value.contacts).
        const pushName = value.contacts?.[0]?.profile?.name ?? null;

        // 1) Status de entrega (mensagens que a LoopSale enviou).
        for (const st of value.statuses ?? []) {
          if (!st.id) continue;
          const status = st.status ?? null;
          const err = st.errors?.[0]?.message ?? null;
          await waCol.updateOne(
            { wamid: st.id },
            {
              $set: {
                status,
                ...(err ? { error: err } : {}),
                updatedAt: now,
              },
            }
          );
          // Reflete no histórico do checkout (campo já existente).
          await eventsCol.updateMany(
            { whatsappMessageId: st.id },
            { $set: { whatsappStatus: status, updatedAt: now } }
          );
        }

        // 2) Mensagens recebidas (respostas do cliente final).
        for (const msg of value.messages ?? []) {
          if (!msg.id) continue;
          // Mídia (imagem/vídeo/áudio/documento/figurinha): guarda o media ID
          // pra buscar depois na Meta, e usa a legenda como corpo quando houver.
          const midia =
            msg.image ?? msg.video ?? msg.audio ?? msg.document ?? msg.sticker;
          const corpo = corpoDaMensagem(msg, midia?.caption);
          const doc: WhatsAppMessage = {
            accountId: accountId ?? "",
            direction: "in",
            wamid: msg.id,
            phoneNumberId,
            contact: msg.from ?? null,
            type: msg.type ?? "text",
            body: corpo,
            mediaId: midia?.id ?? null,
            mimeType: midia?.mime_type ?? null,
            status: "received",
            createdAt: now,
            updatedAt: now,
          };
          // Idempotência por wamid.
          const up = (await waCol.updateOne(
            { wamid: msg.id },
            { $setOnInsert: doc },
            { upsert: true }
          )) as { upsertedId?: unknown };

          // Dispara o robô em mensagem NOVA de texto ou clique de botão (não em
          // reenvio do webhook), com o bot ligado — mídia/reação não disparam.
          const tipoResposta = ["text", "button", "interactive"].includes(
            msg.type ?? "text"
          );
          if (
            up.upsertedId &&
            accountId &&
            msg.from &&
            tipoResposta &&
            corpo &&
            account?.attendantBot?.enabled
          ) {
            paraResponder.set(`${accountId}:${phoneNumberId}:${msg.from}`, {
              account: account as unknown as Account,
              contact: msg.from,
              phoneNumberId,
            });
          }

          // Notifica (push) em qualquer mensagem nova recebida.
          if (up.upsertedId && accountId && msg.from) {
            paraNotificar.push({
              accountId,
              title: pushName || msg.from,
              body: corpo || "Nova mensagem",
            });
          }

          // Mensagem nova reabre a conversa: se ficasse resolvida, sumiria do
          // board e ninguém responderia o cliente. Reabrir de novo não muda
          // nada, então o reenvio do webhook é inofensivo.
          if (accountId && msg.from) {
            // Estado da conversa: só separa por canal em contas multi-número.
            const convChannel = conversationChannelKey(
              account as unknown as Account,
              phoneNumberId
            );
            const convCol = await getCollection("conversations");
            await convCol.updateOne(
              {
                accountId,
                contact: msg.from,
                phoneNumberId: convChannel,
                status: { $in: ["resolved", "snoozed", "pending"] },
              },
              {
                $set: {
                  status: "open",
                  resolvedAt: null,
                  snoozedUntil: null,
                  updatedAt: now,
                },
              }
            );
            // Guarda o nome do perfil do WhatsApp (cria a conversa se não existir),
            // para exibir o nome quando não há lead casado pelo telefone.
            if (pushName) {
              await convCol.updateOne(
                { accountId, contact: msg.from, phoneNumberId: convChannel },
                {
                  $set: { waName: pushName, updatedAt: now },
                  $setOnInsert: {
                    accountId,
                    contact: msg.from,
                    phoneNumberId: convChannel,
                    status: "open",
                    createdAt: now,
                  },
                },
                { upsert: true }
              );
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("whatsapp webhook:", e);
  }

  // Responde o cliente com o robô e envia os pushes depois do 200 (não bloqueia
  // a Meta).
  if (paraResponder.size || paraNotificar.length) {
    after(async () => {
      for (const { account, contact, phoneNumberId } of paraResponder.values()) {
        try {
          await responderComBot(account, contact, phoneNumberId);
        } catch (e) {
          console.error("bot atendimento:", e);
        }
      }
      for (const n of paraNotificar) {
        try {
          await enviarPush(n.accountId, {
            title: n.title,
            body: n.body.slice(0, 120),
            url: "/loopchat",
          });
        } catch (e) {
          console.error("push:", e);
        }
      }
    });
  }

  return NextResponse.json({ received: true });
}

/** Gera e envia a resposta do robô para uma conversa, com os guarda-corpos. */
async function responderComBot(
  account: Account,
  contact: string,
  phoneNumberIdMsg: string | null
): Promise<void> {
  const bot = account.attendantBot;
  if (!bot?.enabled) return;

  // Responde pelo mesmo canal (número) em que a mensagem chegou.
  const canal = findChannel(account, phoneNumberIdMsg);
  const token = await resolveSendToken(channelSendConfig(canal));
  const phoneNumberId = canal?.phoneNumberId ?? "";
  if (!token || !phoneNumberId) return;
  // Estado da conversa: só separa por canal em contas multi-número.
  const convKey = conversationChannelKey(account, phoneNumberId);

  const accountId = String(account._id);
  const convCol = await getCollection("conversations");
  const conv = (await convCol.findOne({
    accountId,
    contact,
    phoneNumberId: convKey,
  })) as Conversation | null;
  // Humano assumiu (atribuída) ou já foi repassada: bot fica quieto.
  if (conv?.assigneeId || conv?.botPaused) return;

  // Histórico recente da conversa (sem notas internas), em ordem cronológica.
  const waCol = await getCollection("whatsappMessages");
  const rows = (await waCol
    .find({ accountId, contact, phoneNumberId, internal: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(15)
    .toArray()) as WhatsAppMessage[];
  const history: AttendantTurn[] = rows
    .reverse()
    .map((m) => ({
      role: (m.direction === "in" ? "customer" : "assistant") as AttendantTurn["role"],
      text: (m.body ?? "").trim(),
    }))
    .filter((t) => t.text.length > 0);

  // Última precisa ser do cliente; se já respondemos, não responde de novo.
  if (!history.length || history[history.length - 1].role !== "customer") return;

  const out = await generateAttendantReply({
    instructions: bot.instructions,
    knowledge: bot.knowledge,
    history,
  });
  if (out.error || !out.reply) return; // erro/sem resposta: deixa para o humano

  const result = await sendText({
    phoneNumberId,
    to: contact,
    body: out.reply,
    token,
  });

  const now = new Date();
  await waCol.insertOne({
    accountId,
    direction: "out",
    wamid: result.wamid ?? null,
    phoneNumberId,
    contact,
    type: "text",
    body: out.reply,
    authorName: "Robô de atendimento",
    status: result.success ? "accepted" : "failed",
    error: result.error ?? null,
    createdAt: now,
    updatedAt: now,
  } as WhatsAppMessage & { _id?: unknown });

  // Repasse a humano: pausa o bot e mantém a conversa aberta para o time pegar.
  if (out.handoff) {
    await convCol.updateOne(
      { accountId, contact, phoneNumberId: convKey },
      {
        $set: { botPaused: true, status: "open", updatedAt: now },
        $setOnInsert: { accountId, contact, phoneNumberId: convKey, createdAt: now },
      },
      { upsert: true }
    );
  }
}
