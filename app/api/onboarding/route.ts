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
    return NextResponse.json({
      onboarded: true,
      platform: null,
      companyName: "",
      platformConnected: true,
      loopConnected: true,
      awaitingApproval: false,
      welcomeSeen: true,
    });
  }

  const accountsCol = await getCollection("accounts");
  const accOid = await routeObjectId(su.accountId);
  const account = accOid
    ? ((await accountsCol.findOne({ _id: accOid })) as Account | null)
    : null;

  const platform = account?.platform ?? null;
  const companyName = account?.name ?? "";

  // Sem plataforma definida (contas antigas) => libera e não mostra tour.
  if (!platform) {
    return NextResponse.json({
      onboarded: true,
      platform: null,
      companyName,
      platformConnected: true,
      loopConnected: true,
      awaitingApproval: false,
      welcomeSeen: true,
    });
  }

  // Precisa de DUAS integrações ativas: a plataforma escolhida E a Loop API.
  const integrationsCol = await getCollection("integrations");
  const list = (await integrationsCol
    .find({ accountId: su.accountId, active: true })
    .toArray()) as Integration[];

  const platformConnected = list.some((i) => i.platform === platform);
  const loopConnected = list.some((i) => i.platform === "n8n");
  const integrationsDone = platformConnected && loopConnected;
  const approved = !!account?.approvedAt;

  // Só libera após aprovação do time LoopSale. Com as integrações prontas mas
  // sem aprovação => "aguardando ativação".
  return NextResponse.json({
    onboarded: approved,
    platform,
    companyName,
    platformConnected,
    loopConnected,
    awaitingApproval: integrationsDone && !approved,
    welcomeSeen: !!account?.welcomeSeenAt,
  });
}

/** Marca que o cliente já viu o tour de boas-vindas (mostrado 1x após ativar). */
export async function POST() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ ok: true });
  }
  const accountsCol = await getCollection("accounts");
  const accOid = await routeObjectId(su.accountId);
  if (accOid) {
    await accountsCol.updateOne(
      { _id: accOid },
      { $set: { welcomeSeenAt: new Date(), updatedAt: new Date() } }
    );
  }
  return NextResponse.json({ ok: true });
}
