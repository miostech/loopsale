import { getCollection } from "@/lib/db";
import type { Account, Conversation, WhatsAppMessage } from "@/lib/db/types";
import {
  conversationChannelKey,
  findChannel,
  channelSendConfig,
} from "@/lib/whatsapp/channels";
import { resolveSendToken } from "@/lib/whatsapp/central-config";
import { sendText } from "@/lib/whatsapp/cloud";

const JANELA_MS = 24 * 60 * 60 * 1000;
const AUTOR_BOT = "Robô de atendimento";

/** Lembrete fixo quando o cliente some depois de uma mensagem do bot. */
const MSG_CUTUCAO =
  "Oi! Ficou com alguma dúvida? 🩷 Se quiser, posso te ajudar por aqui.";

const NAO_MEXER = new Set(["resolved", "pending", "snoozed"]);

type UltimoDaConversa = {
  _id: { contact: string; phoneNumberId: string | null };
  ultimaEm: Date;
  ultimaDirecao: string;
  ultimoAutor: string | null;
  ultimaRecebidaEm: Date | null;
};

/**
 * "Cutucão": quando a última mensagem foi do BOT e o cliente ficou N minutos
 * sem responder (ainda dentro da janela de 24h), manda um lembrete uma única
 * vez. Não mexe em conversa resolvida/adiada/pendente, atribuída ou repassada.
 */
export async function nudgeForAccount(
  account: Pick<Account, "_id" | "attendantBot" | "channels" | "whatsapp">
): Promise<number> {
  const bot = account.attendantBot;
  const minutos = bot?.nudgeMinutes ?? 0;
  if (!bot?.enabled || !minutos || minutos <= 0) return 0;

  const accountId = String(account._id);
  const agora = Date.now();
  const corte = new Date(agora - minutos * 60 * 1000);
  const janela = new Date(agora - JANELA_MS);

  const waCol = await getCollection("whatsappMessages");
  const ultimos = (await waCol
    .aggregate([
      { $match: { accountId, contact: { $ne: null }, internal: { $ne: true } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: { contact: "$contact", phoneNumberId: "$phoneNumberId" },
          ultimaEm: { $last: "$createdAt" },
          ultimaDirecao: { $last: "$direction" },
          ultimoAutor: { $last: "$authorName" },
          ultimaRecebidaEm: {
            $max: { $cond: [{ $eq: ["$direction", "in"] }, "$createdAt", null] },
          },
        },
      },
      {
        // Última é do bot, já passou do tempo e a janela de 24h ainda está aberta.
        $match: {
          ultimaDirecao: "out",
          ultimoAutor: AUTOR_BOT,
          ultimaEm: { $lt: corte },
          ultimaRecebidaEm: { $ne: null, $gt: janela },
        },
      },
    ])
    .toArray()) as UltimoDaConversa[];

  if (!ultimos.length) return 0;

  const convCol = await getCollection("conversations");
  const convs = (await convCol
    .find({
      accountId,
      contact: { $in: [...new Set(ultimos.map((u) => u._id.contact))] },
    })
    .toArray()) as Conversation[];
  const estadoPorChave = new Map<string, Conversation>();
  for (const c of convs) {
    estadoPorChave.set(`${c.contact}|${c.phoneNumberId ?? ""}`, c);
  }

  let cutucadas = 0;
  for (const u of ultimos) {
    const convKey = conversationChannelKey(account as Account, u._id.phoneNumberId);
    const doc = estadoPorChave.get(`${u._id.contact}|${convKey ?? ""}`);
    // Já mexida por alguém, atribuída, repassada ou já cutucada: pula.
    if (
      doc &&
      (NAO_MEXER.has(doc.status) || doc.assigneeId || doc.botPaused || doc.nudgedAt)
    ) {
      continue;
    }

    const canal = findChannel(account as Account, u._id.phoneNumberId);
    const token = await resolveSendToken(channelSendConfig(canal));
    const phoneNumberId = canal?.phoneNumberId ?? "";
    if (!token || !phoneNumberId) continue;

    const result = await sendText({
      phoneNumberId,
      to: u._id.contact,
      body: MSG_CUTUCAO,
      token,
    });
    const now = new Date();
    await waCol.insertOne({
      accountId,
      direction: "out",
      wamid: result.wamid ?? null,
      phoneNumberId,
      contact: u._id.contact,
      type: "text",
      body: MSG_CUTUCAO,
      authorName: AUTOR_BOT,
      status: result.success ? "accepted" : "failed",
      error: result.error ?? null,
      createdAt: now,
      updatedAt: now,
    } as WhatsAppMessage & { _id?: unknown });

    await convCol.updateOne(
      { accountId, contact: u._id.contact, phoneNumberId: convKey },
      {
        $set: { nudgedAt: now, updatedAt: now },
        $setOnInsert: {
          accountId,
          contact: u._id.contact,
          phoneNumberId: convKey,
          status: "open",
          createdAt: now,
        },
      },
      { upsert: true }
    );
    cutucadas++;
  }
  return cutucadas;
}
