import { getCollection, isDatabaseDisabled } from "@/lib/db";

/** Um segmento de recuperação (abandonados ou recusados) já formatado p/ UI. */
export type RecoverySegment = {
  /** Total de checkouts recuperáveis no período. */
  total: number;
  /** Quantos voltaram a comprar (recoveredAt != null). */
  recuperados: number;
  /** Soma do valor de todos os recuperáveis (a oportunidade), em Reais. */
  valorEmRisco: string;
  /** Soma do valor pago dos recuperados, em Reais. */
  valorRecuperado: string;
  /** Soma do valor pago dos recuperados, em Dólares. */
  valorRecuperadoDolar: string;
  /** recuperados / total * 100 (arredondado). */
  taxa: number;
};

/** Variação percentual vs. período anterior de mesmo tamanho (null se sem base). */
export type MetricsVariation = {
  valorRecuperado: number | null;
  vendasRecuperadas: number | null;
  taxaRecuperacao: number | null;
  valorEmRisco: number | null;
};

export type DashboardMetrics = {
  periodoDias: number;
  checkoutsIniciados: number;
  mensagensEnviadas: number;
  /** Recuperáveis (abandonado+recusado) que receberam ≥1 WhatsApp (funil). */
  abordados: number;
  abandonados: RecoverySegment;
  recusados: RecoverySegment;
  /** Combinação de abandonados + recusados. */
  total: RecoverySegment;
  variacao: MetricsVariation;
};

export type DailyMetric = {
  date: string;
  checkoutsIniciados: number;
  carrinhosAbandonados: number;
  vendasRecuperadas: number;
  valorRecuperado: string;
};

/** Números crus de um segmento, antes de formatar. */
type CoreSegment = {
  total: number;
  recuperados: number;
  valorEmRisco: number;
  valorRecuperado: number;
  valorRecuperadoDolar: number;
};

/** Métricas cruas de uma janela [from, to), usadas p/ período atual e anterior. */
type CoreMetrics = {
  checkoutsIniciados: number;
  mensagensEnviadas: number;
  abandonados: CoreSegment;
  recusados: CoreSegment;
};

const emptySegment = (): CoreSegment => ({
  total: 0,
  recuperados: 0,
  valorEmRisco: 0,
  valorRecuperado: 0,
  valorRecuperadoDolar: 0,
});

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function toSegment(core: CoreSegment): RecoverySegment {
  return {
    total: core.total,
    recuperados: core.recuperados,
    valorEmRisco: core.valorEmRisco.toFixed(2),
    valorRecuperado: core.valorRecuperado.toFixed(2),
    valorRecuperadoDolar: core.valorRecuperadoDolar.toFixed(2),
    taxa: core.total > 0 ? Math.round((core.recuperados / core.total) * 100) : 0,
  };
}

function combineSegments(a: CoreSegment, b: CoreSegment): CoreSegment {
  return {
    total: a.total + b.total,
    recuperados: a.recuperados + b.recuperados,
    valorEmRisco: a.valorEmRisco + b.valorEmRisco,
    valorRecuperado: a.valorRecuperado + b.valorRecuperado,
    valorRecuperadoDolar: a.valorRecuperadoDolar + b.valorRecuperadoDolar,
  };
}

// ---------------------------------------------------------------------------
// Mock determinístico (DATABASE_DISABLED=true) para desenvolver sem MongoDB.
// ---------------------------------------------------------------------------

function mockCore(periodDays: number, seedOffset: number): CoreMetrics {
  let checkoutsIniciados = 0;
  let mensagensEnviadas = 0;
  const abandonados = emptySegment();
  const recusados = emptySegment();

  for (let i = periodDays - 1; i >= 0; i--) {
    const k = i + seedOffset;
    const started = 10 + ((k * 7) % 11); // 10..20
    const aband = started * 2 + ((k * 3) % 5); // ~20..45
    const refus = 3 + ((k * 2) % 6); // ~3..9
    const abandRecuperados = Math.max(0, Math.round(aband * 0.3));
    const refusRecuperados = Math.max(0, Math.round(refus * 0.45)); // recusados convertem melhor
    const ticket = 25 + ((k * 5) % 25); // 25..49

    checkoutsIniciados += started;
    mensagensEnviadas += aband + refus + ((k * 2) % 7);

    const usdRate = 5.4; // câmbio fictício p/ o mock (R$ -> US$)

    abandonados.total += aband;
    abandonados.recuperados += abandRecuperados;
    abandonados.valorEmRisco += aband * ticket;
    abandonados.valorRecuperado += abandRecuperados * ticket;
    abandonados.valorRecuperadoDolar += (abandRecuperados * ticket) / usdRate;

    recusados.total += refus;
    recusados.recuperados += refusRecuperados;
    recusados.valorEmRisco += refus * ticket;
    recusados.valorRecuperado += refusRecuperados * ticket;
    recusados.valorRecuperadoDolar += (refusRecuperados * ticket) / usdRate;
  }

  return { checkoutsIniciados, mensagensEnviadas, abandonados, recusados };
}

// ---------------------------------------------------------------------------
// Cálculo real (MongoDB) de uma janela [from, to).
// ---------------------------------------------------------------------------

async function computeCoreMetrics(
  accountId: string,
  from: Date,
  to: Date
): Promise<CoreMetrics> {
  const checkoutEventsCol = await getCollection("checkoutEvents");
  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");
  const window = { createdAt: { $gte: from, $lt: to } };

  const [startedRow] = await checkoutEventsCol
    .aggregate([
      { $match: { accountId, eventType: "checkout_iniciado", ...window } },
      { $count: "count" },
    ])
    .toArray();

  const [messagesRow] = await checkoutEventsCol
    .aggregate([
      { $match: { accountId, eventType: "whatsapp_enviado", ...window } },
      { $count: "count" },
    ])
    .toArray();

  // Um grupo por recoveryType; documentos antigos (sem o campo) = "abandoned".
  const bySegment = (await abandonedCheckoutsCol
    .aggregate([
      { $match: { accountId, ...window } },
      {
        $group: {
          _id: { $ifNull: ["$recoveryType", "abandoned"] },
          total: { $sum: 1 },
          valorEmRisco: {
            $sum: { $toDouble: { $ifNull: ["$amount", "0"] } },
          },
          recuperados: {
            $sum: { $cond: [{ $ne: ["$recoveredAt", null] }, 1, 0] },
          },
          valorRecuperado: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$recoveredAt", null] },
                    {
                      $ne: [
                        { $toUpper: { $ifNull: ["$recoveredCurrency", "BRL"] } },
                        "USD",
                      ],
                    },
                  ],
                },
                {
                  $toDouble: {
                    $ifNull: ["$recoveredAmount", { $ifNull: ["$amount", "0"] }],
                  },
                },
                0,
              ],
            },
          },
          valorRecuperadoDolar: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$recoveredAt", null] },
                    {
                      $eq: [
                        { $toUpper: { $ifNull: ["$recoveredCurrency", "BRL"] } },
                        "USD",
                      ],
                    },
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
    _id: string;
    total: number;
    valorEmRisco: number;
    recuperados: number;
    valorRecuperado: number;
    valorRecuperadoDolar: number;
  }[];

  const abandonados = emptySegment();
  const recusados = emptySegment();
  for (const row of bySegment) {
    const seg = row._id === "refused" ? recusados : abandonados;
    seg.total = row.total;
    seg.recuperados = row.recuperados;
    seg.valorEmRisco = row.valorEmRisco;
    seg.valorRecuperado = row.valorRecuperado;
    seg.valorRecuperadoDolar = row.valorRecuperadoDolar;
  }

  return {
    checkoutsIniciados: startedRow?.count ?? 0,
    mensagensEnviadas: messagesRow?.count ?? 0,
    abandonados,
    recusados,
  };
}

/**
 * Estágio "abordados" do funil: quantos checkouts recuperáveis receberam ao
 * menos um WhatsApp no período. Aproximado por interseção de telefones entre
 * os recuperáveis e os eventos whatsapp_enviado (o n8n sempre tem o telefone).
 */
async function computeAbordados(
  accountId: string,
  from: Date,
  to: Date
): Promise<number> {
  const checkoutEventsCol = await getCollection("checkoutEvents");
  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");
  const window = { createdAt: { $gte: from, $lt: to } };

  const distinctPhones = async (
    col: Awaited<ReturnType<typeof getCollection>>,
    match: Record<string, unknown>
  ): Promise<string[]> => {
    const rows = (await col
      .aggregate([
        { $match: { accountId, customerPhone: { $nin: [null, ""] }, ...match } },
        { $group: { _id: "$customerPhone" } },
      ])
      .toArray()) as { _id: string }[];
    return rows.map((r) => r._id);
  };

  const recoverablePhones = await distinctPhones(abandonedCheckoutsCol, window);
  if (recoverablePhones.length === 0) return 0;

  const messagedPhones = await distinctPhones(checkoutEventsCol, {
    eventType: "whatsapp_enviado",
    ...window,
  });

  const messagedSet = new Set(messagedPhones);
  let count = 0;
  for (const phone of recoverablePhones) {
    if (messagedSet.has(phone)) count++;
  }
  return count;
}

function assembleMetrics(
  periodDays: number,
  current: CoreMetrics,
  previous: CoreMetrics,
  abordados: number
): DashboardMetrics {
  const totalCore = combineSegments(current.abandonados, current.recusados);
  const prevTotal = combineSegments(previous.abandonados, previous.recusados);

  const curTaxa =
    totalCore.total > 0
      ? Math.round((totalCore.recuperados / totalCore.total) * 100)
      : 0;
  const prevTaxa =
    prevTotal.total > 0
      ? Math.round((prevTotal.recuperados / prevTotal.total) * 100)
      : 0;

  return {
    periodoDias: periodDays,
    checkoutsIniciados: current.checkoutsIniciados,
    mensagensEnviadas: current.mensagensEnviadas,
    abordados,
    abandonados: toSegment(current.abandonados),
    recusados: toSegment(current.recusados),
    total: toSegment(totalCore),
    variacao: {
      valorRecuperado: pctChange(
        totalCore.valorRecuperado,
        prevTotal.valorRecuperado
      ),
      vendasRecuperadas: pctChange(
        totalCore.recuperados,
        prevTotal.recuperados
      ),
      taxaRecuperacao: pctChange(curTaxa, prevTaxa),
      valorEmRisco: pctChange(totalCore.valorEmRisco, prevTotal.valorEmRisco),
    },
  };
}

export async function getDashboardMetrics(
  accountId: string,
  periodDays: number = 30
): Promise<DashboardMetrics> {
  if (isDatabaseDisabled()) {
    const current = mockCore(periodDays, 0);
    const previous = mockCore(periodDays, periodDays);
    const abordados = Math.round(
      (current.abandonados.total + current.recusados.total) * 0.7
    );
    return assembleMetrics(periodDays, current, previous, abordados);
  }

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - periodDays);
  const prevStart = new Date(now);
  prevStart.setDate(prevStart.getDate() - periodDays * 2);

  const [current, previous, abordados] = await Promise.all([
    computeCoreMetrics(accountId, start, now),
    computeCoreMetrics(accountId, prevStart, start),
    computeAbordados(accountId, start, now),
  ]);

  return assembleMetrics(periodDays, current, previous, abordados);
}

export async function getDashboardDailyMetrics(
  accountId: string,
  periodDays: number = 30
): Promise<DailyMetric[]> {
  if (isDatabaseDisabled()) {
    const now = new Date();
    const out: DailyMetric[] = [];

    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);

      const started = 10 + ((i * 7) % 11);
      const aband = started * 2 + ((i * 3) % 5);
      const refus = 3 + ((i * 2) % 6);
      const recoverable = aband + refus;
      const recovered = Math.max(0, Math.round(recoverable * 0.33));
      const ticket = 25 + ((i * 5) % 25);

      out.push({
        date: d.toISOString(),
        checkoutsIniciados: started,
        carrinhosAbandonados: recoverable,
        vendasRecuperadas: recovered,
        valorRecuperado: (recovered * ticket).toFixed(2),
      });
    }

    return out;
  }

  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const checkoutEventsCol = await getCollection("checkoutEvents");
  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");

  const startedByDay = await checkoutEventsCol
    .aggregate([
      {
        $match: {
          accountId,
          eventType: "checkout_iniciado",
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const abandonedByDay = await abandonedCheckoutsCol
    .aggregate([
      { $match: { accountId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          total: { $sum: { $toDouble: { $ifNull: ["$amount", "0"] } } },
        },
      },
    ])
    .toArray();

  const recoveredByDay = await abandonedCheckoutsCol
    .aggregate([
      {
        $match: {
          accountId,
          createdAt: { $gte: since },
          recoveredAt: { $ne: null },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$recoveredAt" } },
          count: { $sum: 1 },
          total: { $sum: { $toDouble: { $ifNull: ["$amount", "0"] } } },
        },
      },
    ])
    .toArray();

  const dateMap = new Map<
    string,
    {
      checkoutsIniciados: number;
      carrinhosAbandonados: number;
      vendasRecuperadas: number;
      valorRecuperado: string;
    }
  >();

  const ensure = (d: string) => {
    if (!dateMap.has(d))
      dateMap.set(d, {
        checkoutsIniciados: 0,
        carrinhosAbandonados: 0,
        vendasRecuperadas: 0,
        valorRecuperado: "0",
      });
    return dateMap.get(d)!;
  };

  for (const row of startedByDay as { _id: string; count: number }[]) {
    ensure(row._id).checkoutsIniciados = row.count;
  }
  for (const row of abandonedByDay as {
    _id: string;
    count: number;
    total: number;
  }[]) {
    ensure(row._id).carrinhosAbandonados = row.count;
  }
  for (const row of recoveredByDay as {
    _id: string;
    count: number;
    total: number;
  }[]) {
    const cur = ensure(row._id);
    cur.vendasRecuperadas = row.count;
    cur.valorRecuperado = row.total.toFixed(2);
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}
