import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import {
  stripeConfigured,
  createCustomer,
  createSetupCheckoutSession,
} from "@/lib/billing/stripe";

type SessionUser = { accountId?: string; role?: string; email?: string | null };

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://loopsale.com.br";
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (su.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem cadastrar o cartão." },
      { status: 403 }
    );
  }
  if (isDatabaseDisabled() || !stripeConfigured()) {
    return NextResponse.json(
      { error: "Pagamento ainda não configurado (Stripe)." },
      { status: 503 }
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

    const returnBase = `${baseUrl()}/dashboard/configuracoes/planos`;
    const checkout = await createSetupCheckoutSession({
      customer: customerId,
      successUrl: `${returnBase}?cartao=ok`,
      cancelUrl: `${returnBase}?cartao=cancelado`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao cadastrar o cartão.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
