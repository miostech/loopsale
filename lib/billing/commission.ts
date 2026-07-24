import { getCollection } from "@/lib/db";

/** Comissão do plano Free sobre vendas recuperadas. */
export const FREE_COMMISSION_RATE = 0.4;

/** Taxa de conversão USD -> BRL (definida via env, ajustável). */
export function usdToBrlRate(): number {
  const r = Number(process.env.USD_BRL_RATE);
  return Number.isFinite(r) && r > 0 ? r : 5.4;
}

export type CommissionCalc = {
  /** Recuperado cobrável (sem afiliado), por moeda. */
  recuperadoBrl: number;
  recuperadoUsd: number;
  usdRate: number;
  /** Base cobrável em R$ (recuperado sem afiliado, USD convertido). */
  baseBrl: number;
  rate: number;
  /** Total a cobrar no cartão em R$ (USD convertido — Stripe cobra 1 moeda). */
  comissaoBrl: number;
  /** Comissão sobre vendas em real (recuperadoBrl × taxa). */
  comissaoRealBrl: number;
  /** Comissão sobre vendas em dólar (recuperadoUsd × taxa), em US$. */
  comissaoUsd: number;
  /** Recuperado via afiliado Mios Tech (comissão já paga na Kiwify), em R$. */
  pagaKiwifyBrl: number;
  /** Idem, em US$ (separado do real). */
  pagaKiwifyUsd: number;
  /**
   * Comissão retida: reembolso ativo pedido pelo VENDEDOR. Não é cobrada
   * automaticamente nem cancelada — fica para revisão manual (possível manobra
   * de fuga da comissão).
   */
  retidaBrl: number;
};

/**
 * Próxima data de cobrança da comissão. A cobrança roda no dia 1 e no dia 16 de
 * cada mês (quinzenal, via cron), então a próxima é o próximo dia 16 (se estamos
 * antes dele) ou o dia 1 do mês seguinte.
 */
export function nextChargeDate(now: Date): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (now.getUTCDate() < 16) return new Date(Date.UTC(y, m, 16));
  return new Date(Date.UTC(y, m + 1, 1));
}

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
  to: Date,
  rate: number
): Promise<CommissionCalc> {
  const col = await getCollection("abandonedCheckouts");
  const isUsd = {
    $eq: [{ $toUpper: { $ifNull: ["$recoveredCurrency", "BRL"] } }, "USD"],
  };
  const value = {
    $toDouble: { $ifNull: ["$recoveredAmount", { $ifNull: ["$amount", "0"] }] },
  };
  // Cobrável = recuperação SEM comissão já paga na Kiwify (afiliado Mios Tech).
  const cobravel = { $ne: ["$commissionPaidKiwify", true] };
  const usdRate = usdToBrlRate();
  const valueBrl = { $cond: [isUsd, { $multiply: [value, usdRate] }, value] };

  // Reembolso ativo (pedido/concedido) = pending/refunded.
  const emReembolso = {
    $in: [{ $ifNull: ["$refundStatus", ""] }, ["pending", "refunded"]],
  };
  // Sem reembolso ativo (cancelled/ausente/null) = continua cobrável.
  const semReembolso = { $not: [emReembolso] };
  // Retido = reembolso ativo pedido pelo VENDEDOR: não cobra automaticamente,
  // mas também não cancela (possível manobra de fuga da comissão — revisar).
  const retidoSeller = {
    $and: [
      emReembolso,
      { $eq: [{ $toLower: { $ifNull: ["$refundRequester", ""] } }, "seller"] },
    ],
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
          // Cobrável = recuperado, sem Kiwify, e sem reembolso ativo. Reembolso
          // do buyer cancela; reembolso do seller vai para "retida".
          recuperadoBrl: {
            $sum: {
              $cond: [
                { $and: [cobravel, semReembolso, { $not: [isUsd] }] },
                value,
                0,
              ],
            },
          },
          recuperadoUsd: {
            $sum: {
              $cond: [{ $and: [cobravel, semReembolso, isUsd] }, value, 0],
            },
          },
          retidaBaseBrl: {
            $sum: { $cond: [{ $and: [cobravel, retidoSeller] }, valueBrl, 0] },
          },
          // Recuperado via afiliado Mios (comissão já paga na Kiwify), por moeda.
          pagaKiwifyBrl: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$commissionPaidKiwify", true] }, { $not: [isUsd] }] },
                value,
                0,
              ],
            },
          },
          pagaKiwifyUsd: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$commissionPaidKiwify", true] }, isUsd] },
                value,
                0,
              ],
            },
          },
        },
      },
    ])
    .toArray()) as {
    recuperadoBrl: number;
    recuperadoUsd: number;
    retidaBaseBrl: number;
    pagaKiwifyBrl: number;
    pagaKiwifyUsd: number;
  }[];

  const recuperadoBrl = row?.recuperadoBrl ?? 0;
  const recuperadoUsd = row?.recuperadoUsd ?? 0;
  const pagaKiwifyBrl = row?.pagaKiwifyBrl ?? 0;
  const pagaKiwifyUsd = row?.pagaKiwifyUsd ?? 0;
  const baseBrl = recuperadoBrl + recuperadoUsd * usdRate;
  // Comissão por moeda (USD fica separado do real, conforme a regra).
  const comissaoRealBrl = Math.round(recuperadoBrl * rate * 100) / 100;
  const comissaoUsd = Math.round(recuperadoUsd * rate * 100) / 100;
  // Total a cobrar no cartão (R$): o Stripe cobra numa moeda só, então o USD é
  // convertido aqui — mas o valor em US$ é exibido separado.
  const comissaoBrl = Math.round(baseBrl * rate * 100) / 100;
  const retidaBrl =
    Math.round((row?.retidaBaseBrl ?? 0) * rate * 100) / 100;

  return {
    recuperadoBrl,
    recuperadoUsd,
    usdRate,
    baseBrl,
    rate,
    comissaoBrl,
    comissaoRealBrl,
    comissaoUsd,
    pagaKiwifyBrl,
    pagaKiwifyUsd,
    retidaBrl,
  };
}

/** Início e fim (exclusivo) do mês de uma competência YYYY-MM (UTC). */
export function monthRange(periodKey: string): { from: Date; to: Date } {
  const [y, m] = periodKey.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to };
}

// ---------------------------------------------------------------------------
// Quinzena (cobrança a cada 15 dias): Q1 = dias 1..15, Q2 = 16..fim do mês.
// ---------------------------------------------------------------------------

type Fortnight = { from: Date; to: Date; periodKey: string };

function ym(d: Date): { y: number; m: number; mm: string } {
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    mm: String(d.getUTCMonth() + 1).padStart(2, "0"),
  };
}

/** Quinzena que contém a data (parcial se ainda em curso). */
export function currentFortnight(d: Date): Fortnight {
  const { y, m, mm } = ym(d);
  if (d.getUTCDate() <= 15) {
    return {
      from: new Date(Date.UTC(y, m, 1)),
      to: new Date(Date.UTC(y, m, 16)),
      periodKey: `${y}-${mm}-Q1`,
    };
  }
  return {
    from: new Date(Date.UTC(y, m, 16)),
    to: new Date(Date.UTC(y, m + 1, 1)),
    periodKey: `${y}-${mm}-Q2`,
  };
}

/** Quinzena imediatamente anterior à data (a que já fechou), para cobrar. */
export function previousFortnight(d: Date): Fortnight {
  const { y, m, mm } = ym(d);
  if (d.getUTCDate() >= 16) {
    // Fechou a Q1 do mês atual (1..15).
    return {
      from: new Date(Date.UTC(y, m, 1)),
      to: new Date(Date.UTC(y, m, 16)),
      periodKey: `${y}-${mm}-Q1`,
    };
  }
  // Fechou a Q2 do mês anterior (16..fim).
  const from = new Date(Date.UTC(y, m - 1, 16));
  const to = new Date(Date.UTC(y, m, 1));
  const pmm = String(from.getUTCMonth() + 1).padStart(2, "0");
  return { from, to, periodKey: `${from.getUTCFullYear()}-${pmm}-Q2` };
}

/** Intervalo de uma competência: YYYY-MM-Q1/Q2 (quinzena) ou YYYY-MM (mês). */
export function periodRange(periodKey: string): { from: Date; to: Date } {
  const q = periodKey.match(/^(\d{4})-(\d{2})-(Q1|Q2)$/);
  if (q) {
    const y = Number(q[1]);
    const m = Number(q[2]) - 1;
    return q[3] === "Q1"
      ? { from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m, 16)) }
      : { from: new Date(Date.UTC(y, m, 16)), to: new Date(Date.UTC(y, m + 1, 1)) };
  }
  return monthRange(periodKey);
}
