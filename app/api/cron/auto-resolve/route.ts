import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron/auth";
import type { Account } from "@/lib/db/types";
import { autoResolveForAccount } from "@/lib/loopchat/auto-resolve";

/**
 * Resolve sozinha as conversas do LoopChat que ficaram paradas (cliente parou
 * de responder). Roda periodicamente; cada conta define o tempo em minutos.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountsCol = await getCollection("accounts");
  // Só contas que ligaram o auto-resolver (autoResolveMinutes > 0).
  const contas = (await accountsCol
    .find({ "attendantBot.autoResolveMinutes": { $gt: 0 } })
    .project({ _id: 1, attendantBot: 1, channels: 1, whatsapp: 1 })
    .toArray()) as Account[];

  let total = 0;
  for (const acc of contas) {
    try {
      total += await autoResolveForAccount(acc);
    } catch (e) {
      console.error("auto-resolve:", String(acc._id), e);
    }
  }
  return NextResponse.json({ ok: true, contas: contas.length, resolvidas: total });
}

export async function POST(request: Request) {
  return GET(request);
}
