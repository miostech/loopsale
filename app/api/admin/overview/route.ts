import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import {
  isSuperAdmin,
  metaCostPerMessageEur,
  eurToBrlRate,
  INACTIVE_AFTER_DAYS,
} from "@/lib/admin";
import {
  commissionRateOf,
  getPlan,
  subscriptionRevenueOf,
} from "@/lib/billing/plans";
import { computeCommission, currentFortnight } from "@/lib/billing/commission";

type SessionUser = { email?: string | null };
const ABERTO = ["failed", "no_card", "pending", "invoiced"];
const DAY = 86400000;

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({
      totals: {
        empresas: 0,
        ativos: 0,
        inativos: 0,
        aReceber: 0,
        recebido: 0,
        emAberto: 0,
        mrr: 0,
        custoMeta: 0,
        margem: 0,
      },
      empresas: [],
    });
  }

  const accountsCol = await getCollection("accounts");
  const commissionsCol = await getCollection("commissions");
  const usersCol = await getCollection("users");
  const eventsCol = await getCollection("checkoutEvents");

  const accounts = (await accountsCol
    .find({})
    .toArray()) as (Account & { _id: ObjectId })[];

  const now = new Date();
  const quinzena = currentFortnight(now);
  const metaCostEur = metaCostPerMessageEur();
  const eurRate = eurToBrlRate();
  const metaCostBrl = metaCostEur * eurRate;

  // Comissões por conta e situação (pago x em aberto).
  const histRows = (await commissionsCol
    .aggregate([
      {
        $group: {
          _id: { accountId: "$accountId", status: "$status" },
          total: { $sum: "$comissaoBrl" },
        },
      },
    ])
    .toArray()) as { _id: { accountId: string; status: string }; total: number }[];
  const recebidoBy: Record<string, number> = {};
  const abertoBy: Record<string, number> = {};
  for (const r of histRows) {
    const acc = r._id.accountId;
    if (r._id.status === "paid") recebidoBy[acc] = (recebidoBy[acc] ?? 0) + r.total;
    else if (ABERTO.includes(r._id.status))
      abertoBy[acc] = (abertoBy[acc] ?? 0) + r.total;
  }

  // Última atividade + nº de mensagens por conta (uma passada só).
  const evRows = (await eventsCol
    .aggregate([
      {
        $group: {
          _id: "$accountId",
          lastAt: { $max: "$createdAt" },
          msgs: {
            $sum: { $cond: [{ $eq: ["$eventType", "whatsapp_enviado"] }, 1, 0] },
          },
        },
      },
    ])
    .toArray()) as { _id: string; lastAt: Date; msgs: number }[];
  const evBy: Record<string, { lastAt: Date | null; msgs: number }> = {};
  for (const e of evRows) evBy[e._id] = { lastAt: e.lastAt, msgs: e.msgs };

  // Usuários por conta.
  const userRows = (await usersCol
    .aggregate([{ $group: { _id: "$accountId", n: { $sum: 1 } } }])
    .toArray()) as { _id: string; n: number }[];
  const membrosBy: Record<string, number> = {};
  for (const u of userRows) membrosBy[u._id] = u.n;

  const empresas = [];
  let totAReceber = 0;
  let totRecebido = 0;
  let totAberto = 0;
  let totMrr = 0;
  let totCustoMeta = 0;
  let totCustoMetaEur = 0;
  let ativos = 0;
  let inativos = 0;

  for (const acc of accounts) {
    const accountId = String(acc._id);
    const plan = getPlan(acc.subscription?.plan);
    const rate = commissionRateOf(acc.subscription?.plan);
    const calc =
      rate > 0
        ? await computeCommission(accountId, quinzena.from, now, rate)
        : { comissaoBrl: 0, baseBrl: 0 };

    const recebido = recebidoBy[accountId] ?? 0;
    const emAberto = abertoBy[accountId] ?? 0;
    const ev = evBy[accountId] ?? { lastAt: null, msgs: 0 };
    const mensagens = ev.msgs;
    const custoMetaEur = Math.round(mensagens * metaCostEur * 100) / 100;
    const custoMeta = Math.round(mensagens * metaCostBrl * 100) / 100;
    const assinaturaMensal = subscriptionRevenueOf(
      acc.subscription?.plan,
      !!acc.support?.active
    );
    // Margem = comissão gerada (recebida + a receber) menos o custo Meta.
    const margem =
      Math.round((recebido + calc.comissaoBrl - custoMeta) * 100) / 100;
    const dias = ev.lastAt
      ? Math.floor((now.getTime() - new Date(ev.lastAt).getTime()) / DAY)
      : Infinity;
    const ativo = dias <= INACTIVE_AFTER_DAYS;

    totAReceber += calc.comissaoBrl;
    totRecebido += recebido;
    totAberto += emAberto;
    totMrr += assinaturaMensal;
    totCustoMeta += custoMeta;
    totCustoMetaEur += custoMetaEur;
    if (ativo) ativos++;
    else inativos++;

    empresas.push({
      id: accountId,
      nome: acc.name,
      slug: acc.slug,
      plano: plan.id,
      planoNome: plan.name,
      rate,
      criadoEm: acc.createdAt,
      cardOnFile: !!acc.subscription?.defaultPaymentMethod,
      membros: membrosBy[accountId] ?? 0,
      recuperadoQuinzena: calc.baseBrl,
      aReceberQuinzena: calc.comissaoBrl,
      recebido,
      emAberto,
      assinaturaMensal,
      mensagens,
      custoMeta,
      custoMetaEur,
      margem,
      ultimaAtividade: ev.lastAt,
      ativo,
    });
  }

  empresas.sort((a, b) => b.aReceberQuinzena - a.aReceberQuinzena);

  return NextResponse.json({
    periodo: quinzena.periodKey,
    metaCostEur,
    eurRate,
    totals: {
      empresas: accounts.length,
      ativos,
      inativos,
      aReceber: Math.round(totAReceber * 100) / 100,
      recebido: Math.round(totRecebido * 100) / 100,
      emAberto: Math.round(totAberto * 100) / 100,
      mrr: Math.round(totMrr * 100) / 100,
      custoMeta: Math.round(totCustoMeta * 100) / 100,
      custoMetaEur: Math.round(totCustoMetaEur * 100) / 100,
      margem:
        Math.round((totRecebido + totAReceber - totCustoMeta) * 100) / 100,
    },
    empresas,
  });
}
