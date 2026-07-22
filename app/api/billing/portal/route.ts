import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { stripeConfigured, createPortalSession } from "@/lib/billing/stripe";

type SessionUser = { accountId?: string; role?: string };

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
      { error: "Apenas administradores gerenciam a assinatura." },
      { status: 403 }
    );
  }
  if (isDatabaseDisabled() || !stripeConfigured()) {
    return NextResponse.json(
      { error: "Pagamento ainda não configurado." },
      { status: 503 }
    );
  }

  const accountsCol = await getCollection("accounts");
  const oid = await routeObjectId(su.accountId);
  const account = oid
    ? ((await accountsCol.findOne({ _id: oid })) as Account | null)
    : null;
  const customerId = account?.subscription?.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json(
      { error: "Nenhuma assinatura para gerenciar ainda." },
      { status: 400 }
    );
  }

  try {
    const portal = await createPortalSession({
      customer: customerId,
      returnUrl: `${baseUrl()}/dashboard/configuracoes/planos`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao abrir o portal.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
