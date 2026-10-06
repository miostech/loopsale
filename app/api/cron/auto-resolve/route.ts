import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron/auth";
import type { Account } from "@/lib/db/types";
import { autoResolveForAccount } from "@/lib/loopchat/auto-resolve";
import { nudgeForAccount } from "@/lib/loopchat/nudge";

/**
 * Resolve sozinha as conversas do LoopChat que ficaram paradas (cliente parou
 * de responder). Roda periodicamente; cada conta define o tempo em minutos.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountsCol = await getCollection("accounts");
  // Contas que ligaram o auto-resolver e/ou o "cutucão".
  const contas = (await accountsCol
    .find({
      $or: [
        { "attendantBot.autoResolveMinutes": { $gt: 0 } },
        { "attendantBot.nudgeMinutes": { $gt: 0 } },
      ],
    })
    .project({ _id: 1, attendantBot: 1, channels: 1, whatsapp: 1 })
    .toArray()) as Account[];

  let cutucadas = 0;
  let resolvidas = 0;
  for (const acc of contas) {
    // Cutuca antes de resolver: quem some depois do bot ganha um lembrete, e só
    // depois (se continuar em silêncio) a conversa é resolvida.
    try {
      cutucadas += await nudgeForAccount(acc);
    } catch (e) {
      console.error("nudge:", String(acc._id), e);
    }
    try {
      resolvidas += await autoResolveForAccount(acc);
    } catch (e) {
      console.error("auto-resolve:", String(acc._id), e);
    }
  }
  return NextResponse.json({
    ok: true,
    contas: contas.length,
    cutucadas,
    resolvidas,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
