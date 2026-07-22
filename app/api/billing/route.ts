import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { PLANS, getPlan } from "@/lib/billing/plans";
import { stripeConfigured } from "@/lib/billing/stripe";

type SessionUser = { accountId?: string; role?: string };

export async function GET() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const publicPlans = PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    priceMonthly: p.priceMonthly,
    priceNote: p.priceNote ?? null,
    description: p.description,
    features: p.features,
    highlighted: p.highlighted ?? false,
    disponivel: p.id === "free" || !!p.priceId, // pagos só se houver priceId
  }));

  if (isDatabaseDisabled()) {
    return NextResponse.json({
      planoAtual: "free",
      status: "none",
      currentPeriodEnd: null,
      configured: stripeConfigured(),
      isAdmin: su.role === "admin",
      plans: publicPlans,
      temAssinatura: false,
    });
  }

  const accountsCol = await getCollection("accounts");
  const oid = await routeObjectId(su.accountId);
  const account = oid
    ? ((await accountsCol.findOne({ _id: oid })) as Account | null)
    : null;
  const sub = account?.subscription ?? null;

  return NextResponse.json({
    planoAtual: getPlan(sub?.plan).id,
    status: sub?.status ?? "none",
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    configured: stripeConfigured(),
    isAdmin: su.role === "admin",
    temAssinatura: !!sub?.stripeSubscriptionId,
    plans: publicPlans,
  });
}
