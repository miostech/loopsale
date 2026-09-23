import { getCollection } from "@/lib/db";
import type { Account, Conversation } from "@/lib/db/types";
import { conversationChannelKey } from "@/lib/whatsapp/channels";

type UltimoDaConversa = {
  _id: { contact: string; phoneNumberId: string | null };
  ultimaEm: Date;
  ultimaDirecao: string;
};

// Estados que já foram decididos por alguém — o auto-resolver não mexe.
const NAO_MEXER = new Set(["resolved", "pending", "snoozed"]);

/**
 * Resolve sozinha as conversas abertas paradas: a última mensagem foi nossa
 * (cliente parou de responder) e já passou do tempo configurado. Não mexe em
 * conversas que alguém deixou pendente/adiada/resolvida de propósito.
 */
export async function autoResolveForAccount(
  account: Pick<Account, "_id" | "attendantBot" | "channels" | "whatsapp">
): Promise<number> {
  const minutos = account.attendantBot?.autoResolveMinutes ?? 0;
  if (!minutos || minutos <= 0) return 0;

  const accountId = String(account._id);
  const corte = new Date(Date.now() - minutos * 60 * 1000);

  const waCol = await getCollection("whatsappMessages");
  const ultimos = (await waCol
    .aggregate([
      {
        $match: {
          accountId,
          contact: { $ne: null },
          internal: { $ne: true },
        },
      },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: { contact: "$contact", phoneNumberId: "$phoneNumberId" },
          ultimaEm: { $last: "$createdAt" },
          ultimaDirecao: { $last: "$direction" },
        },
      },
      // Só interessa quem a gente falou por último e já passou do corte.
      { $match: { ultimaDirecao: "out", ultimaEm: { $lt: corte } } },
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

  const now = new Date();
  let resolvidas = 0;
  for (const u of ultimos) {
    const convKey = conversationChannelKey(account as Account, u._id.phoneNumberId);
    const doc = estadoPorChave.get(`${u._id.contact}|${convKey ?? ""}`);
    // Já resolvida/pendente/adiada = deixa como está.
    if (doc && NAO_MEXER.has(doc.status)) continue;
    await convCol.updateOne(
      { accountId, contact: u._id.contact, phoneNumberId: convKey },
      {
        $set: {
          status: "resolved",
          resolvedAt: now,
          resolvedBy: "auto: inatividade",
          snoozedUntil: null,
          updatedAt: now,
        },
        $setOnInsert: {
          accountId,
          contact: u._id.contact,
          phoneNumberId: convKey,
          createdAt: now,
        },
      },
      { upsert: true }
    );
    resolvidas++;
  }
  return resolvidas;
}
