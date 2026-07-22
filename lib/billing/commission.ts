import { getCollection } from "@/lib/db";

/** Comissão do plano Free sobre vendas recuperadas. */
export const FREE_COMMISSION_RATE = 0.4;

/** Taxa de conversão USD -> BRL (definida via env, ajustável). */
export function usdToBrlRate(): number {
  const r = Number(process.env.USD_BRL_RATE);
  return Number.isFinite(r) && r > 0 ? r : 5.4;
}

export type CommissionCalc = {
  recuperadoBrl: number;
  recuperadoUsd: number;
  usdRate: number;
  baseBrl: number;
  rate: number;
  comissaoBrl: number;
};

/** Chave de competência YYYY-MM a partir de uma data (mês da data). */
export function periodKeyOf(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Apura a comissão de uma conta sobre as vendas recuperadas no período
 * [from, to). Soma o valor recuperado por moeda, converte USD->BRL e aplica
 * a taxa da comissão. Base = recoveredAt dentro do período.
 */
export async function computeCommission(
  accountId: string,
  from: Date,
  to: Date
): Promise<CommissionCalc> {
  const col = await getCollection("abandonedCheckouts");
  const isUsd = {
    $eq: [{ $toUpper: { $ifNull: ["$recoveredCurrency", "BRL"] } }, "USD"],
  };
  const value = {
    $toDouble: { $ifNull: ["$recoveredAmount", { $ifNull: ["$amount", "0"] }] },
  };

  const [row] = (await col
    .aggregate([
      {
        $match: {
          accountId,
          recoveredAt: { $ne: null, $gte: from, $lt: to },
        },
      },
      {
        $group: {
          _id: null,
          recuperadoBrl: { $sum: { $cond: [isUsd, 0, value] } },
          recuperadoUsd: { $sum: { $cond: [isUsd, value, 0] } },
        },
      },
    ])
    .toArray()) as { recuperadoBrl: number; recuperadoUsd: number }[];

  const recuperadoBrl = row?.recuperadoBrl ?? 0;
  const recuperadoUsd = row?.recuperadoUsd ?? 0;
  const usdRate = usdToBrlRate();
  const baseBrl = recuperadoBrl + recuperadoUsd * usdRate;
  const comissaoBrl = Math.round(baseBrl * FREE_COMMISSION_RATE * 100) / 100;

  return {
    recuperadoBrl,
    recuperadoUsd,
    usdRate,
    baseBrl,
    rate: FREE_COMMISSION_RATE,
    comissaoBrl,
  };
}

/** Início e fim (exclusivo) do mês de uma competência YYYY-MM (UTC). */
export function monthRange(periodKey: string): { from: Date; to: Date } {
  const [y, m] = periodKey.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to };
}
