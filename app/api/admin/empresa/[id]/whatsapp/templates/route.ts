import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin";
import type { Account } from "@/lib/db/types";
import { listTemplates, usesCentralWaba, centralWabaId } from "@/lib/whatsapp/cloud";
import { resolveSendToken } from "@/lib/whatsapp/central-config";

type SessionUser = { email?: string | null };

/** Templates da WABA desta empresa (própria ou central). Só super-admin. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ templates: [], connected: false });
  }

  const { id } = await params;
  const oid = await routeObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const accountsCol = await getCollection("accounts");
  const account = (await accountsCol.findOne({ _id: oid })) as Account | null;
  const wa = account?.whatsapp ?? null;

  // Origem da conta define o WABA e o token (próprio ou central).
  const wabaId = usesCentralWaba(wa?.source) ? centralWabaId() : wa?.wabaId ?? "";
  const token = await resolveSendToken(wa);
  if (!wabaId || !token) {
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
