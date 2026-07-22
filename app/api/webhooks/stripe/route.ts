import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { verifyStripeSignature } from "@/lib/billing/stripe";
import { planByPriceId } from "@/lib/billing/plans";

export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!verifyStripeSignature(raw, sig, process.env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json(
      { error: "Assinatura inválida" },
      { status: 400 }
    );
  }
  if (isDatabaseDisabled()) return NextResponse.json({ received: true });

  let event: {
    type: string;
    data: { object: Record<string, unknown> };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const obj = event.data.object;

  if (event.type.startsWith("customer.subscription.")) {
    const customerId = String(obj.customer ?? "");
    if (!customerId) return NextResponse.json({ received: true });

    const deleted = event.type === "customer.subscription.deleted";
    const status = deleted ? "canceled" : String(obj.status ?? "active");
    const items = obj.items as { data?: { price?: { id?: string } }[] } | undefined;
    const priceId = items?.data?.[0]?.price?.id ?? null;
    const plan = deleted ? "free" : planByPriceId(priceId)?.id ?? "pro";
    const cpe = obj.current_period_end
      ? new Date(Number(obj.current_period_end) * 1000)
      : null;

    const accountsCol = await getCollection("accounts");
    await accountsCol.updateOne(
      { "subscription.stripeCustomerId": customerId },
      {
        $set: {
          "subscription.plan": plan,
          "subscription.status": status,
          "subscription.stripeSubscriptionId": String(obj.id ?? ""),
          "subscription.currentPeriodEnd": cpe,
          updatedAt: new Date(),
        },
      }
    );
  }

  return NextResponse.json({ received: true });
}
