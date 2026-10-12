import { getCollection } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { responderComBot } from "@/lib/loopchat/bot";

// Não responde a mensagens muito antigas (ex.: conversa parada) — só às recentes
// que estão dentro da janela de debounce.
const IDADE_MAX_MS = 30 * 60 * 1000;

type UltimoDaConversa = {
  _id: { contact: string; phoneNumberId: string | null };
  ultimaEm: Date;
  ultimaDirecao: string;
};

/**
 * Responde (via bot) as conversas cuja última mensagem é do cliente e já ficou
 * em silêncio pelo tempo configurado — assim o bot espera a pessoa terminar de
 * escrever e responde com todo o contexto. Chamado pelo cron a cada minuto.
 */
export async function processBotRepliesForAccount(
  account: Pick<Account, "_id" | "attendantBot" | "channels" | "whatsapp">
): Promise<number> {
  const bot = account.attendantBot;
  if (!bot?.enabled) return 0;
  const delaySeg = bot.replyDelaySeconds ?? 60;
  if (delaySeg <= 0) return 0; // modo imediato é tratado no webhook

  const accountId = String(account._id);
  const agora = Date.now();
  const corteMax = new Date(agora - delaySeg * 1000); // silêncio >= delay
  const corteMin = new Date(agora - IDADE_MAX_MS); // mas não antiga demais

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
        },
      },
      // Última é do cliente, já passou o silêncio e não é antiga demais.
      {
        $match: {
          ultimaDirecao: "in",
          ultimaEm: { $lte: corteMax, $gte: corteMin },
        },
      },
    ])
    .toArray()) as UltimoDaConversa[];

  let respondidas = 0;
  for (const u of ultimos) {
    try {
      // responderComBot revalida tudo (última é do cliente, não atribuída/pausada,
      // horário, handoff, done, etc.).
      await responderComBot(account as Account, u._id.contact, u._id.phoneNumberId);
      respondidas++;
    } catch (e) {
      console.error("bot-reply:", accountId, u._id.contact, e);
    }
  }
  return respondidas;
}
