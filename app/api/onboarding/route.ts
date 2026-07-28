import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account, Integration } from "@/lib/db/types";

type SessionUser = { accountId?: string };

/**
 * Estado do onboarding da conta. O dashboard usa isto para liberar/bloquear.
 * onboarded = a conta já conectou a integração da plataforma escolhida.
 * Contas antigas (sem platform definido) nunca são bloqueadas.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Modo demo / sem banco: nunca bloqueia.
  if (isDatabaseDisabled()) {
    return NextResponse.json({ onboarded: true, platform: null, companyName: "" });
  }

  const accountsCol = await getCollection("accounts");
  const accOid = await routeObjectId(su.accountId);
  const account = accOid
    ? ((await accountsCol.findOne({ _id: accOid })) as Account | null)
    : null;

  const platform = account?.platform ?? null;
  const companyName = account?.name ?? "";

  // Sem plataforma definida (contas antigas) => libera.
  if (!platform) {
    return NextResponse.json({ onboarded: true, platform: null, companyName });
  }

  // Precisa de uma integração ATIVA da plataforma escolhida.
  const integrationsCol = await getCollection("integrations");
  const integ = (await integrationsCol.findOne({
    accountId: su.accountId,
    platform,
    active: true,
  })) as Integration | null;

  return NextResponse.json({
    onboarded: !!integ,
    platform,
    companyName,
  });
}
