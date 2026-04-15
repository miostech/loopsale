import { getCollection, isDatabaseDisabled } from "@/lib/db";

export type DashboardMetrics = {
  checkoutsIniciados: number;
  carrinhosAbandonados: number;
  vendasRecuperadas: number;
  valorRecuperado: string;
  taxaRecuperacao: number;
  periodoDias: number;
};

export type DailyMetric = {
  date: string;
  checkoutsIniciados: number;
  carrinhosAbandonados: number;
  vendasRecuperadas: number;
  valorRecuperado: string;
};

export async function getDashboardMetrics(
  accountId: string,
  periodDays: number = 30
): Promise<DashboardMetrics> {
  if (isDatabaseDisabled()) {
    // Mock deterministico para a UI testar sem MongoDB.
    // PeriodDays pode chegar a 90, mas o Dashboard lida bem com ~90 pontos.
    const now = new Date();

    let checkoutsIniciados = 0;
    let carrinhosAbandonados = 0;
    let vendasRecuperadas = 0;
    let valorRecuperadoTotal = 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _seed = accountId; // reservado para futuras variações por tenant

    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);

      const started = 10 + ((i * 7) % 11); // 10..20-ish
      const abandoned = started * 2 + ((i * 3) % 5); // ~20..50-ish
      const recovered = Math.max(0, Math.round(abandoned * 0.3)); // 30%

      // Valor por venda varia um pouco ao longo do tempo.
      const ticket = 25 + ((i * 5) % 25); // 25..49
      const dayValue = recovered * ticket;

      checkoutsIniciados += started;
      carrinhosAbandonados += abandoned;
      vendasRecuperadas += recovered;
      valorRecuperadoTotal += dayValue;
    }

    const recoveryRate =
      carrinhosAbandonados > 0
        ? Math.round((vendasRecuperadas / carrinhosAbandonados) * 100)
        : 0;

    return {
      checkoutsIniciados,
      carrinhosAbandonados,
      vendasRecuperadas,
      valorRecuperado: valorRecuperadoTotal.toFixed(2),
      taxaRecuperacao: recoveryRate,
      periodoDias: periodDays,
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const checkoutEventsCol = await getCollection("checkoutEvents");
  const abandonedCheckoutsCol = await getCollection("abandonedCheckouts");

  const [startedCount] = await checkoutEventsCol
    .aggregate([
      {
        $match: {
          accountId,
          eventType: "checkout_iniciado",
          createdAt: { $gte: since },
        },
      },
      { $count: "count" },
    ])
    .toArray();

  const [abandonedResult] = await abandonedCheckoutsCol
    .aggregate([
      { $match: { accountId, createdAt: { $gte: since } } },
      { $count: "count" },
    ])
    .toArray();

  const [recoveredResult] = await abandonedCheckoutsCol
    .aggregate([
      {
        $match: {
          accountId,
          createdAt: { $gte: since },
          recoveredAt: { $ne: null },
        },
      },
      { $count: "count" },
    ])
    .toArray();

  const [recoveredValueResult] = await abandonedCheckoutsCol
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
          _id: null,
          total: { $sum: { $toDouble: { $ifNull: ["$amount", "0"] } } },
        },
      },
    ])
    .toArray();

  const started = startedCount?.count ?? 0;
  const abandoned = abandonedResult?.count ?? 0;
  const recovered = recoveredResult?.count ?? 0;
  const recoveryRate =
    abandoned > 0 ? Math.round((recovered / abandoned) * 100) : 0;
  const totalValue = recoveredValueResult?.total ?? 0;

  return {
    checkoutsIniciados: started,
    carrinhosAbandonados: abandoned,
    vendasRecuperadas: recovered,
    valorRecuperado: String(totalValue.toFixed(2)),
    taxaRecuperacao: recoveryRate,
    periodoDias: periodDays,
  };
}

export async function getDashboardDailyMetrics(
  accountId: string,
  periodDays: number = 30
): Promise<DailyMetric[]> {
  if (isDatabaseDisabled()) {
    const now = new Date();
    const out: DailyMetric[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _seed = accountId;

    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);

      const started = 10 + ((i * 7) % 11);
      const abandoned = started * 2 + ((i * 3) % 5);
      const recovered = Math.max(0, Math.round(abandoned * 0.3));
      const ticket = 25 + ((i * 5) % 25);
      const dayValue = recovered * ticket;

      out.push({
        date: d.toISOString(),
        checkoutsIniciados: started,
        carrinhosAbandonados: abandoned,
        vendasRecuperadas: recovered,
        valorRecuperado: dayValue.toFixed(2),
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

  for (const row of startedByDay as { _id: string; count: number }[]) {
    const d = row._id;
    if (!dateMap.has(d))
      dateMap.set(d, {
        checkoutsIniciados: 0,
        carrinhosAbandonados: 0,
        vendasRecuperadas: 0,
        valorRecuperado: "0",
      });
    dateMap.get(d)!.checkoutsIniciados = row.count;
  }
  for (const row of abandonedByDay as { _id: string; count: number; total: number }[]) {
    const d = row._id;
    if (!dateMap.has(d))
      dateMap.set(d, {
        checkoutsIniciados: 0,
        carrinhosAbandonados: 0,
        vendasRecuperadas: 0,
        valorRecuperado: "0",
      });
    dateMap.get(d)!.carrinhosAbandonados = row.count;
  }
  for (const row of recoveredByDay as { _id: string; count: number; total: number }[]) {
    const d = row._id;
    if (!dateMap.has(d))
      dateMap.set(d, {
        checkoutsIniciados: 0,
        carrinhosAbandonados: 0,
        vendasRecuperadas: 0,
        valorRecuperado: "0",
      });
    const cur = dateMap.get(d)!;
    cur.vendasRecuperadas = row.count;
    cur.valorRecuperado = String(row.total.toFixed(2));
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}
