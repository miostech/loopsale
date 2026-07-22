import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { stripeConfigured, listInvoices } from "@/lib/billing/stripe";

type SessionUser = { accountId?: string };

export async function GET() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (isDatabaseDisabled() || !stripeConfigured()) {
    return NextResponse.json({ invoices: [] });
  }

  const accountsCol = await getCollection("accounts");
  const oid = await routeObjectId(su.accountId);
  const account = oid
    ? ((await accountsCol.findOne({ _id: oid })) as Account | null)
    : null;
  const customerId = account?.subscription?.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json({ invoices: [] });
  }

  try {
    const invoices = await listInvoices(customerId, 12);
    return NextResponse.json({ invoices });
  } catch {
    return NextResponse.json({ invoices: [] });
  }
}
