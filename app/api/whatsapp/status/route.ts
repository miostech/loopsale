import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { tokenFor } from "@/lib/whatsapp/cloud";

type SessionUser = { accountId?: string };

/** Estado da conexão WhatsApp da conta (WABA + número). */
export async function GET() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ connected: false });
  }

  const accountsCol = await getCollection("accounts");
  const accOid = await routeObjectId(su.accountId);
  const account = accOid
    ? ((await accountsCol.findOne({ _id: accOid })) as Account | null)
    : null;
  const wa = account?.whatsapp ?? null;

  return NextResponse.json({
    connected: !!(wa?.wabaId && wa?.accessToken),
    // canSend diz se o cron consegue disparar: token próprio, ou conta legada
    // na WABA central. É o que decide se os fluxos de WhatsApp saem do papel.
    canSend: !!tokenFor(wa?.accessToken, wa?.source),
    source: wa?.source ?? "own",
    wabaId: wa?.wabaId ?? null,
    phoneNumberId: wa?.phoneNumberId ?? null,
    displayNumber: wa?.displayNumber ?? null,
    connectedAt: wa?.connectedAt ?? null,
  });
}
