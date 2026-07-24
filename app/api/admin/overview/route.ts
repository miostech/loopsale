import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { Account, CommissionRecord } from "@/lib/db/types";
import { isSuperAdmin } from "@/lib/admin";
import { commissionRateOf, getPlan } from "@/lib/billing/plans";
import { computeCommission, currentFortnight } from "@/lib/billing/commission";

type SessionUser = { email?: string | null };

const ABERTO = ["failed", "no_card", "pending", "invoiced"];

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({
      totals: { empresas: 0, aReceber: 0, recebido: 0, emAberto: 0, recuperadoBrl: 0 },
      empresas: [],
    });
  }

  const accountsCol = await getCollection("accounts");
  const commissionsCol = await getCollection("commissions");
  const usersCol = await getCollection("users");

  const accounts = (await accountsCol
    .find({})
    .toArray()) as (Account & { _id: ObjectId })[];

  const now = new Date();
  const quinzena = currentFortnight(now);

  // Histórico de comissões agrupado por conta e situação (pago x em aberto).
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

  const empresas = [];
  let totAReceber = 0;
  let totRecebido = 0;
  let totAberto = 0;
  let totRecuperado = 0;

  for (const acc of accounts) {
    const accountId = String(acc._id);
    const plan = getPlan(acc.subscription?.plan);
    const rate = commissionRateOf(acc.subscription?.plan);
    // Comissão a receber nesta quinzena (parcial, até agora).
    const calc =
      rate > 0
        ? await computeCommission(accountId, quinzena.from, now, rate)
        : { comissaoBrl: 0, baseBrl: 0, recuperadoBrl: 0, recuperadoUsd: 0 };

    // Nº de usuários (tamanho da equipe da empresa).
    const membros = await usersCol.countDocuments({ accountId });

    const recebido = recebidoBy[accountId] ?? 0;
    const emAberto = abertoBy[accountId] ?? 0;

    totAReceber += calc.comissaoBrl;
    totRecebido += recebido;
    totAberto += emAberto;
    totRecuperado += calc.baseBrl;

    empresas.push({
      id: accountId,
      nome: acc.name,
      slug: acc.slug,
      plano: plan.id,
      planoNome: plan.name,
      rate,
      criadoEm: acc.createdAt,
      cardOnFile: !!acc.subscription?.defaultPaymentMethod,
      membros,
      recuperadoQuinzena: calc.baseBrl,
      aReceberQuinzena: calc.comissaoBrl,
      recebido,
      emAberto,
    });
  }

  empresas.sort((a, b) => b.aReceberQuinzena - a.aReceberQuinzena);

  return NextResponse.json({
    periodo: quinzena.periodKey,
    totals: {
      empresas: accounts.length,
      aReceber: totAReceber,
      recebido: totRecebido,
      emAberto: totAberto,
      recuperadoBrl: totRecuperado,
    },
    empresas,
  });
}
