import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDocs } from "@/lib/db";
import type { AbandonedCheckout } from "@/lib/db/types";

/** Valor recuperado (líquido pago), com fallback ao valor do carrinho. */
const recoveredValueExpr = {
  $toDouble: { $ifNull: ["$recoveredAmount", { $ifNull: ["$amount", "0"] }] },
};
const isUsdExpr = {
  $eq: [{ $toUpper: { $ifNull: ["$recoveredCurrency", "BRL"] } }, "USD"],
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const accountId = session.user.accountId;

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const affiliate = url.searchParams.get("affiliate") ?? "";
  const product = url.searchParams.get("product") ?? "";
  const search = url.searchParams.get("search") ?? "";
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit")) || 25)
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  // Recuperadas = carrinho com recoveredAt preenchido, filtrado por período
  // sobre a data de recuperação.
  const recoveredAt: Record<string, unknown> = { $ne: null };
  if (from) recoveredAt.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    recoveredAt.$lte = end;
  }
  const filter: Record<string, unknown> = { accountId, recoveredAt };
  if (affiliate) filter.affiliate = affiliate;
  if (product) filter.productName = product;
  if (search) {
    filter.$or = [
      { customerEmail: { $regex: search, $options: "i" } },
      { customerPhone: { $regex: search, $options: "i" } },
    ];
  }

  const col = await getCollection("abandonedCheckouts");

  const list = (await col
    .find(filter)
    .sort({ recoveredAt: -1 })
    .skip(offset)
    .limit(limit)
    .toArray()) as (AbandonedCheckout & { _id: unknown })[];

  const total = await col.countDocuments(filter);

  const [summaryRow] = (await col
    .aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          valorBrl: {
            $sum: { $cond: [isUsdExpr, 0, recoveredValueExpr] },
          },
          valorUsd: {
            $sum: { $cond: [isUsdExpr, recoveredValueExpr, 0] },
          },
        },
      },
    ])
    .toArray()) as { count: number; valorBrl: number; valorUsd: number }[];

  const daily = (await col
    .aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$recoveredAt" } },
          count: { $sum: 1 },
          valorBrl: { $sum: { $cond: [isUsdExpr, 0, recoveredValueExpr] } },
          valorUsd: { $sum: { $cond: [isUsdExpr, recoveredValueExpr, 0] } },
        },
      },
      { $sort: { _id: -1 } },
    ])
    .toArray()) as {
    _id: string;
    count: number;
    valorBrl: number;
    valorUsd: number;
  }[];

  // Opções de filtro (afiliados e produtos de todas as vendas recuperadas).
  const optionsBase = { accountId, recoveredAt: { $ne: null } };
  const affiliatesRows = (await col
    .aggregate([
      { $match: { ...optionsBase, affiliate: { $nin: [null, ""] } } },
      { $group: { _id: "$affiliate" } },
      { $sort: { _id: 1 } },
    ])
    .toArray()) as { _id: string }[];
  const productsRows = (await col
    .aggregate([
      { $match: { ...optionsBase, productName: { $nin: [null, ""] } } },
      { $group: { _id: "$productName" } },
      { $sort: { _id: 1 } },
    ])
    .toArray()) as { _id: string }[];

  return NextResponse.json({
    sales: mapDocs(list).map((s) => ({
      id: s.id,
      recoveredAt: s.recoveredAt,
      customerEmail: s.customerEmail,
      customerPhone: s.customerPhone,
      productName: s.productName,
      amount: s.recoveredAmount ?? s.amount ?? null,
      currency: s.recoveredCurrency ?? "BRL",
      fees: s.recoveredFees ?? null,
      affiliate: s.affiliate,
      recoveryType: s.recoveryType ?? "abandoned",
    })),
    total,
    summary: summaryRow ?? { count: 0, valorBrl: 0, valorUsd: 0 },
    daily: daily.map((d) => ({
      date: d._id,
      count: d.count,
      valorBrl: d.valorBrl,
      valorUsd: d.valorUsd,
    })),
    affiliates: affiliatesRows.map((r) => r._id),
    products: productsRows.map((r) => r._id),
  });
}
