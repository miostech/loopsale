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
import { isSuperAdmin } from "@/lib/admin";
import { commissionRateOf, getPlan } from "@/lib/billing/plans";
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
          kiwify: {
            $sum: {
              $cond: [
                { $eq: ["$commissionPaidKiwify", true] },
                { $toDouble: { $ifNull: ["$recoveredAmount", { $ifNull: ["$amount", "0"] }] } },
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray()) as { total: number; brl: number; usd: number; kiwify: number }[];

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
    },
    quinzena: { periodKey: quinzena.periodKey, ...calc },
    totais: {
      recebido,
      emAberto,
      recuperadoTotalBrl: agg?.brl ?? 0,
      recuperadoTotalUsd: agg?.usd ?? 0,
      recuperadoViaKiwify: agg?.kiwify ?? 0,
      recuperadasTotal: agg?.total ?? 0,
    },
    historico: mapDocs(historico),
  });
}
