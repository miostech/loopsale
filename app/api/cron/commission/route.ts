import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { Account, CommissionRecord } from "@/lib/db/types";
import { stripeConfigured, chargeInvoice } from "@/lib/billing/stripe";
import { commissionRateOf } from "@/lib/billing/plans";
import {
  computeCommission,
  previousFortnight,
  periodRange,
} from "@/lib/billing/commission";

/** Valor mínimo para gerar cobrança (evita faturas irrisórias). */
const MIN_COMMISSION_BRL = 5;

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Aceita ?secret= (manual) ou o header do Vercel Cron (Authorization Bearer).
  const secretOk = url.searchParams.get("secret") === process.env.CRON_SECRET;
  const headerOk =
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!secretOk && !headerOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ ok: true, skipped: "db disabled" });
  }

  // Competência = quinzena que acabou de fechar (override por ?period=YYYY-MM-Q1).
  const now = new Date();
  const override = url.searchParams.get("period");
  const periodKey = override ?? previousFortnight(now).periodKey;
  const { from, to } = periodRange(periodKey);

  const accountsCol = await getCollection("accounts");
  const commissionsCol = await getCollection("commissions");

  // Contas de planos que cobram comissão (Free e Pro; contas sem plano = Free).
  const accountsList = (await accountsCol
    .find({
      $or: [
        { "subscription.plan": "free" },
        { "subscription.plan": "pro" },
        { "subscription.plan": { $exists: false } },
        { subscription: null },
      ],
    })
    .toArray()) as (Account & { _id: ObjectId })[];

  let processed = 0;
  let charged = 0;
  const results: Record<string, string> = {};

  for (const account of accountsList) {
    const accountId = String(account._id);
    const rate = commissionRateOf(account.subscription?.plan);
    if (rate <= 0) continue;
    processed++;

    const existing = (await commissionsCol.findOne({
      accountId,
      periodKey,
    })) as CommissionRecord | null;
    if (existing && ["paid", "invoiced"].includes(existing.status)) {
      results[accountId] = "já cobrado";
      continue;
    }

    const calc = await computeCommission(accountId, from, to, rate);
    const now2 = new Date();
    const base: Omit<CommissionRecord, "_id"> = {
      accountId,
      periodKey,
      periodStart: from,
      periodEnd: to,
      recuperadoBrl: calc.recuperadoBrl,
      recuperadoUsd: calc.recuperadoUsd,
      usdRate: calc.usdRate,
      baseBrl: calc.baseBrl,
      rate: calc.rate,
      comissaoBrl: calc.comissaoBrl,
      status: "pending",
      stripeInvoiceId: existing?.stripeInvoiceId ?? null,
      createdAt: existing ? existing.createdAt : now2,
      updatedAt: now2,
    };

    if (calc.comissaoBrl < MIN_COMMISSION_BRL) {
      base.status = "zero";
      results[accountId] = "abaixo do mínimo";
    } else {
      const customerId = account.subscription?.stripeCustomerId ?? null;
      const hasCard = !!account.subscription?.defaultPaymentMethod;
      if (!stripeConfigured() || !customerId || !hasCard) {
        base.status = "no_card";
        results[accountId] = "sem cartão/stripe";
      } else {
        try {
          const inv = await chargeInvoice({
            customer: customerId,
            amountBrl: calc.comissaoBrl,
            description: `Comissão LoopSale — ${periodKey} (${Math.round(
              calc.rate * 100
            )}% sobre vendas recuperadas)`,
          });
          base.status = inv.status === "paid" ? "paid" : "invoiced";
          base.stripeInvoiceId = inv.invoiceId;
          charged++;
          results[accountId] = base.status;
        } catch (e) {
          base.status = "failed";
          results[accountId] = e instanceof Error ? e.message : "falha";
        }
      }
    }

    await commissionsCol.updateOne(
      { accountId, periodKey },
      { $set: base },
      { upsert: true }
    );
  }

  return NextResponse.json({ ok: true, periodKey, processed, charged, results });
}

export async function POST(request: Request) {
  return GET(request);
}
