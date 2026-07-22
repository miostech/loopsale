import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { PLANS, SUPPORT_ADDON } from "@/lib/billing/plans";
import {
  stripeConfigured,
  createCustomer,
  createCheckoutSession,
} from "@/lib/billing/stripe";

type SessionUser = {
  accountId?: string;
  role?: string;
  email?: string | null;
};

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://loopsale.com.br";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (su.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem contratar planos." },
      { status: 403 }
    );
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json(
      { error: "Indisponível no modo demo." },
      { status: 503 }
    );
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Pagamento ainda não configurado (Stripe)." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  // Aceita { plan } (assinatura do plano) ou { addon: "support" } (atendimento).
  const priceId =
    body.addon === "support"
      ? SUPPORT_ADDON.priceId
      : PLANS.find((p) => p.id === body.plan)?.priceId ?? null;
  if (!priceId) {
    return NextResponse.json(
      { error: "Plano/add-on inválido ou sem preço configurado." },
      { status: 400 }
    );
  }

  const accountsCol = await getCollection("accounts");
  const oid = await routeObjectId(su.accountId);
  const account = oid
    ? ((await accountsCol.findOne({ _id: oid })) as (Account & { _id: ObjectId }) | null)
    : null;
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  try {
    // Reaproveita o customer do Stripe, ou cria um novo para a conta.
    let customerId = account.subscription?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await createCustomer({
        email: su.email ?? "",
        name: account.name,
        accountId: su.accountId,
      });
      customerId = customer.id;
      await accountsCol.updateOne(
        { _id: account._id },
        {
          $set: {
            "subscription.stripeCustomerId": customerId,
            "subscription.plan": account.subscription?.plan ?? "free",
            "subscription.status": account.subscription?.status ?? "none",
            updatedAt: new Date(),
          },
        }
      );
    }

    const returnBase = `${baseUrl()}/dashboard/planos`;
    const checkout = await createCheckoutSession({
      customer: customerId,
      priceId,
      accountId: su.accountId,
      successUrl: `${returnBase}?status=sucesso`,
      cancelUrl: `${returnBase}?status=cancelado`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao iniciar o checkout.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
