import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getCollection,
  mapDocs,
  routeObjectId,
  isDatabaseDisabled,
} from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { isSuperAdmin, metaCostPerMessageEur, eurToBrlRate } from "@/lib/admin";
import {
  commissionRateOf,
  getPlan,
  subscriptionRevenueOf,
} from "@/lib/billing/plans";
import {
  computeCommission,
  currentFortnight,
  usdToBrlRate,
} from "@/lib/billing/commission";

type SessionUser = { email?: string | null };
const ABERTO = ["failed", "no_card", "pending", "invoiced"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível no modo demo" }, { status: 503 });
  }

  const { id } = await params;
  const oid = await routeObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const accountsCol = await getCollection("accounts");
  const account = (await accountsCol.findOne({ _id: oid })) as Account | null;
  if (!account) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const accountId = id;
  const plan = getPlan(account.subscription?.plan);
  const rate = commissionRateOf(account.subscription?.plan);

  // Quinzena atual (parcial).
  const now = new Date();
  const quinzena = currentFortnight(now);
  const calc =
    rate > 0
      ? await computeCommission(accountId, quinzena.from, now, rate)
      : {
          recuperadoBrl: 0,
          recuperadoUsd: 0,
          baseBrl: 0,
          comissaoBrl: 0,
          pagaKiwifyBrl: 0,
          retidaBrl: 0,
          usdRate: usdToBrlRate(),
          rate,
        };

  const usersCol = await getCollection("users");
  const membros = await usersCol.countDocuments({ accountId });

  // Mensagens de WhatsApp enviadas (cada uma é custo Meta). Total + na quinzena.
  const eventsCol = await getCollection("checkoutEvents");
  const mensagensTotal = await eventsCol.countDocuments({
    accountId,
    eventType: "whatsapp_enviado",
  });
  const mensagensQuinzena = await eventsCol.countDocuments({
    accountId,
    eventType: "whatsapp_enviado",
    createdAt: { $gte: quinzena.from, $lt: now },
  });
  // Última atividade (qualquer evento) — sinal de integração saudável.
  const ultimoEvento = (await eventsCol
    .find({ accountId })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as { createdAt?: Date }[];
  const ultimaAtividade = ultimoEvento[0]?.createdAt ?? null;

  // Histórico de cobranças.
  const commissionsCol = await getCollection("commissions");
  const historico = await commissionsCol
    .find({ accountId })
    .sort({ periodKey: -1 })
    .limit(24)
    .toArray();

  let recebido = 0;
  let emAberto = 0;
  for (const h of historico as { status: string; comissaoBrl: number }[]) {
    if (h.status === "paid") recebido += h.comissaoBrl;
    else if (ABERTO.includes(h.status)) emAberto += h.comissaoBrl;
  }

  // Recuperação acumulada (todo o período), separada por moeda + Kiwify.
  const carts = await getCollection("abandonedCheckouts");
  const [agg] = (await carts
    .aggregate([
      { $match: { accountId, recoveredAt: { $ne: null } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          brl: {
            $sum: {
              $cond: [
                { $ne: [{ $toUpper: { $ifNull: ["$recoveredCurrency", "BRL"] } }, "USD"] },
                { $toDouble: { $ifNull: ["$recoveredAmount", { $ifNull: ["$amount", "0"] }] } },
                0,
              ],
            },
          },
          usd: {
            $sum: {
              $cond: [
                { $eq: [{ $toUpper: { $ifNull: ["$recoveredCurrency", "BRL"] } }, "USD"] },
                { $toDouble: { $ifNull: ["$recoveredAmount", "0"] } },
                0,
              ],
            },
          },
          kiwifyBrl: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$commissionPaidKiwify", true] },
                    { $ne: [{ $toUpper: { $ifNull: ["$recoveredCurrency", "BRL"] } }, "USD"] },
                  ],
                },
                { $toDouble: { $ifNull: ["$recoveredAmount", { $ifNull: ["$amount", "0"] }] } },
                0,
              ],
            },
          },
          kiwifyUsd: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$commissionPaidKiwify", true] },
                    { $eq: [{ $toUpper: { $ifNull: ["$recoveredCurrency", "BRL"] } }, "USD"] },
                  ],
                },
                { $toDouble: { $ifNull: ["$recoveredAmount", "0"] } },
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray()) as {
    total: number;
    brl: number;
    usd: number;
    kiwifyBrl: number;
    kiwifyUsd: number;
  }[];

  // Conversão: recuperados ÷ recuperáveis (todos os carrinhos abandono/recusa).
  // E conversão por mensagem enviada (quantas viraram venda).
  const recuperaveisTotal = await carts.countDocuments({ accountId });
  const recuperadasTotal = agg?.total ?? 0;
  const taxaConversao =
    recuperaveisTotal > 0 ? recuperadasTotal / recuperaveisTotal : 0;
  const taxaPorMensagem =
    mensagensTotal > 0 ? recuperadasTotal / mensagensTotal : 0;

  // Receita de assinatura (mensal) + custo Meta + margem (comissão − Meta).
  const assinaturaMensal = subscriptionRevenueOf(
    account.subscription?.plan,
    !!account.support?.active
  );
  // Custo Meta em EUR (moeda que a LoopSale paga) e convertido pra R$ (margem).
  const custoMetaEur =
    Math.round(mensagensTotal * metaCostPerMessageEur() * 100) / 100;
  const custoMeta =
    Math.round(mensagensTotal * metaCostPerMessageEur() * eurToBrlRate() * 100) /
    100;
  // Margem = comissão gerada (recebida + a receber) menos o custo Meta (R$).
  const margem =
    Math.round((recebido + calc.comissaoBrl - custoMeta) * 100) / 100;

  return NextResponse.json({
    empresa: {
      id: accountId,
      nome: account.name,
      slug: account.slug,
      plano: plan.id,
      planoNome: plan.name,
      rate,
      criadoEm: account.createdAt,
      cardOnFile: !!account.subscription?.defaultPaymentMethod,
      membros,
      assinaturaMensal,
      ultimaAtividade,
    },
    quinzena: { periodKey: quinzena.periodKey, ...calc },
    totais: {
      recebido,
      emAberto,
      recuperadoTotalBrl: agg?.brl ?? 0,
      recuperadoTotalUsd: agg?.usd ?? 0,
      recuperadoViaKiwifyBrl: agg?.kiwifyBrl ?? 0,
      recuperadoViaKiwifyUsd: agg?.kiwifyUsd ?? 0,
      recuperadasTotal,
      recuperaveisTotal,
      taxaConversao,
      taxaPorMensagem,
      mensagensTotal,
      mensagensQuinzena,
      custoMeta,
      custoMetaEur,
      margem,
    },
    historico: mapDocs(historico),
  });
}
