import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron/auth";
import type { Account } from "@/lib/db/types";
import { processBotRepliesForAccount } from "@/lib/loopchat/bot-replies";

/**
 * Responde com o robô as conversas que ficaram em silêncio pelo tempo
 * configurado (debounce): o bot espera a pessoa terminar de escrever e responde
 * com todo o contexto. Roda a cada minuto.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountsCol = await getCollection("accounts");
  // Contas com o bot ligado e delay > 0 (as de delay 0 respondem no webhook).
  const contas = (await accountsCol
    .find({
      "attendantBot.enabled": true,
      "attendantBot.replyDelaySeconds": { $ne: 0 },
    })
    .project({ _id: 1, attendantBot: 1, channels: 1, whatsapp: 1 })
    .toArray()) as Account[];

  let total = 0;
  for (const acc of contas) {
    try {
      total += await processBotRepliesForAccount(acc);
    } catch (e) {
      console.error("bot-replies:", String(acc._id), e);
    }
  }
  return NextResponse.json({ ok: true, contas: contas.length, respondidas: total });
}

export async function POST(request: Request) {
  return GET(request);
}
