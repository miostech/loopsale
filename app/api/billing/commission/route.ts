import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDocs, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { getPlan } from "@/lib/billing/plans";
import { stripeConfigured } from "@/lib/billing/stripe";
import { computeCommission, periodKeyOf } from "@/lib/billing/commission";

type SessionUser = { accountId?: string; role?: string };

export async function GET() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (isDatabaseDisabled()) {
    return NextResponse.json({
      plano: "free",
      cardOnFile: false,
      configured: stripeConfigured(),
      isAdmin: su.role === "admin",
      periodoAtual: {
        periodKey: "—",
        recuperadoBrl: 0,
        recuperadoUsd: 0,
        baseBrl: 0,
        comissaoBrl: 0,
        pagaKiwifyBrl: 0,
      },
      historico: [],
    });
  }

  const accountsCol = await getCollection("accounts");
  const oid = await routeObjectId(su.accountId);
  const account = oid
    ? ((await accountsCol.findOne({ _id: oid })) as Account | null)
    : null;
  const plano = getPlan(account?.subscription?.plan).id;
  const cardOnFile = !!account?.subscription?.defaultPaymentMethod;

  // Apuração do mês corrente (parcial, até agora).
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const calc = await computeCommission(su.accountId, monthStart, now);

  const commissionsCol = await getCollection("commissions");
  const historico = await commissionsCol
    .find({ accountId: su.accountId })
    .sort({ periodKey: -1 })
    .limit(12)
    .toArray();

  return NextResponse.json({
    plano,
    cardOnFile,
    configured: stripeConfigured(),
    isAdmin: su.role === "admin",
    periodoAtual: { periodKey: periodKeyOf(now), ...calc },
    historico: mapDocs(historico),
  });
}
