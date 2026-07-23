import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { AbandonedCheckout, Account } from "@/lib/db/types";
import { commissionRateOf } from "@/lib/billing/plans";
import { usdToBrlRate, periodRange } from "@/lib/billing/commission";

type SessionUser = { accountId?: string };

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return new Response("Não autorizado", { status: 401 });
  }
  if (isDatabaseDisabled()) {
    return new Response("Indisponível no modo demo", { status: 503 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period"); // YYYY-MM ou YYYY-MM-Q1/Q2

  const match: Record<string, unknown> = {
    accountId: su.accountId,
    recoveredAt: { $ne: null },
  };
  if (period && /^\d{4}-\d{2}(-Q[12])?$/.test(period)) {
    const { from, to } = periodRange(period);
    match.recoveredAt = { $ne: null, $gte: from, $lt: to };
  }

  const col = await getCollection("abandonedCheckouts");
  const rows = (await col
    .find(match)
    .sort({ recoveredAt: -1 })
    .toArray()) as AbandonedCheckout[];

  // Taxa de comissão do plano da conta.
  const accountsCol = await getCollection("accounts");
  const aoid = await routeObjectId(su.accountId);
  const account = aoid
    ? ((await accountsCol.findOne({ _id: aoid })) as Account | null)
    : null;
  const commissionRate = commissionRateOf(account?.subscription?.plan);

  const rate = usdToBrlRate();
  const REFUND_LABEL: Record<string, string> = {
    pending: "Pendente",
    refunded: "Reembolsado",
    cancelled: "Cancelado",
  };

  const header = [
    "Data",
    "Cliente",
    "Telefone",
    "Produto",
    "Valor",
    "Moeda",
    "Valor (R$)",
    "Afiliado",
    "Origem",
    "Reembolso",
    "Solicitante",
    "Status comissão",
    "Comissão LoopSale (R$)",
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const amount = parseFloat(r.recoveredAmount ?? r.amount ?? "0") || 0;
    const currency = (r.recoveredCurrency ?? "BRL").toUpperCase();
    const valorBrl = currency === "USD" ? amount * rate : amount;
    const paga = r.commissionPaidKiwify === true;

    // Estado do reembolso.
    const refund = (r.refundStatus ?? "").toLowerCase();
    const emReembolso = refund === "pending" || refund === "refunded";
    const requester = (r.refundRequester ?? "").toLowerCase();
    const isSeller =
      requester.includes("sell") ||
      requester.includes("vend") ||
      requester.includes("loj");
    const refundLabel = refund ? REFUND_LABEL[refund] ?? refund : "—";
    const requesterLabel = !requester
      ? "—"
      : isSeller
      ? "Vendedor"
      : "Comprador";

    // Status/valor da comissão considerando reembolso.
    const bruto = Math.round(valorBrl * commissionRate * 100) / 100;
    let statusComissao: string;
    let comissao: number;
    if (paga) {
      statusComissao = "Paga na Kiwify";
      comissao = 0;
    } else if (emReembolso && isSeller) {
      statusComissao = "Retida (reembolso do vendedor)";
      comissao = bruto; // retida p/ revisão — não cobrada automaticamente
    } else if (emReembolso) {
      statusComissao = "Cancelada (reembolso do comprador)";
      comissao = 0;
    } else {
      statusComissao = `Cobrada LoopSale (${Math.round(commissionRate * 100)}%)`;
      comissao = bruto;
    }

    const data = r.recoveredAt
      ? new Date(r.recoveredAt).toLocaleString("pt-BR")
      : "";
    lines.push(
      [
        data,
        r.customerEmail ?? "",
        r.customerPhone ?? "",
        r.productName ?? "",
        amount.toFixed(2),
        currency,
        valorBrl.toFixed(2),
        r.recoveredAffiliate ?? "",
        r.recoveryType === "refused" ? "Recusado" : "Abandonado",
        refundLabel,
        requesterLabel,
        statusComissao,
        comissao.toFixed(2),
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const csv = "﻿" + lines.join("\r\n"); // BOM p/ Excel abrir acentos ok
  const fname = `comissoes-${period ?? "todas"}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
