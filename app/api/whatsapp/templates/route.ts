import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import {
  listTemplates,
  tokenFor,
  usesCentralWaba,
  centralWabaId,
} from "@/lib/whatsapp/cloud";

type SessionUser = { accountId?: string };

/** Lista os templates da WABA do cliente, com status. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ templates: [] });
  }

  const accountsCol = await getCollection("accounts");
  const accOid = await routeObjectId(su.accountId);
  const account = accOid
    ? ((await accountsCol.findOne({ _id: accOid })) as Account | null)
    : null;
  // Token e WABA seguem a origem da conta: própria (dados da conta) ou central
  // legada (dados do ambiente).
  const wa = account?.whatsapp ?? null;
  const token = tokenFor(wa?.accessToken, wa?.source);
  const wabaId = usesCentralWaba(wa?.source) ? centralWabaId() : wa?.wabaId ?? "";
  if (!token || !wabaId) {
    return NextResponse.json({ templates: [], connected: false });
  }

  try {
    const templates = await listTemplates(wabaId, token);
    return NextResponse.json({ templates, connected: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar templates.";
    return NextResponse.json({ templates: [], connected: true, error: msg });
  }
}
