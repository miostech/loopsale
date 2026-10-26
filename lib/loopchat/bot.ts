import { getCollection } from "@/lib/db";
import type { Account, Conversation, WhatsAppMessage } from "@/lib/db/types";
import { generateAttendantReply, type AttendantTurn } from "@/lib/ai/attendant";
import { buscarExemplos } from "@/lib/loopchat/examples";
import { handoffDisponivelAgora, MSG_FORA_HORARIO } from "@/lib/loopchat/horario";
import { resolveSendToken } from "@/lib/whatsapp/central-config";
import {
  findChannel,
  channelSendConfig,
  conversationChannelKey,
} from "@/lib/whatsapp/channels";
import { sendText } from "@/lib/whatsapp/cloud";

/** Gera e envia a resposta do robô para uma conversa, com os guarda-corpos. */
export async function responderComBot(
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

  // Aprende com a equipe: exemplos reais parecidos com a mensagem atual.
  const ultimoCliente = history[history.length - 1].text;
  const examples =
    bot.learnFromTeam === false
      ? []
      : await buscarExemplos(accountId, ultimoCliente);

  const out = await generateAttendantReply({
    instructions: bot.instructions,
    knowledge: bot.knowledge,
    examples,
    history,
  });
  if (out.error) {
    // Erro da IA (chave/crédito/modelo): deixa para o humano, mas registra o
    // motivo nos logs — senão o bot "para de responder" em silêncio.
    console.error("bot IA erro:", accountId, out.error);
    return;
  }

  const now = new Date();

  // Handoff fora do horário comercial: não promete atendimento imediato — avisa
  // o horário. A conversa fica na fila do humano.
  const foraHorario =
    out.handoff && !handoffDisponivelAgora(bot.handoffHours, now);
  const reply = foraHorario ? MSG_FORA_HORARIO : out.reply;

  // Sem texto para enviar: resolve (encerramento) ou pausa (handoff) e sai.
  if (!reply) {
    if (out.handoff) {
      await convCol.updateOne(
        { accountId, contact, phoneNumberId: convKey },
        {
          $set: { botPaused: true, status: "open", updatedAt: now },
          $setOnInsert: { accountId, contact, phoneNumberId: convKey, createdAt: now },
        },
        { upsert: true }
      );
    } else if (out.done && bot.closeOnFinish !== false) {
      await convCol.updateOne(
        { accountId, contact, phoneNumberId: convKey },
        {
          $set: {
            status: "resolved",
            resolvedAt: now,
            resolvedBy: "auto: bot (encerrada)",
            snoozedUntil: null,
            updatedAt: now,
          },
          $setOnInsert: { accountId, contact, phoneNumberId: convKey, createdAt: now },
        },
        { upsert: true }
      );
    }
    return;
  }

  const result = await sendText({
    phoneNumberId,
    to: contact,
    body: reply,
    token,
  });

  await waCol.insertOne({
    accountId,
    direction: "out",
    wamid: result.wamid ?? null,
    phoneNumberId,
    contact,
    type: "text",
    body: reply,
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
  } else if (out.done && bot.closeOnFinish !== false) {
    // Cliente encerrou (agradeceu/despediu-se) e o bot respondeu curto: resolve.
    await convCol.updateOne(
      { accountId, contact, phoneNumberId: convKey },
      {
        $set: {
          status: "resolved",
          resolvedAt: now,
          resolvedBy: "auto: bot (encerrada)",
          snoozedUntil: null,
          updatedAt: now,
        },
        $setOnInsert: { accountId, contact, phoneNumberId: convKey, createdAt: now },
      },
      { upsert: true }
    );
  }
}
