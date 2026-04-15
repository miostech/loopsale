"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Metrics {
  checkoutsIniciados: number;
  carrinhosAbandonados: number;
  vendasRecuperadas: number;
  valorRecuperado: string;
  taxaRecuperacao: number;
  periodoDias: number;
  daily?: DailyRow[];
}

interface DailyRow {
  date: string;
  checkoutsIniciados: number;
  carrinhosAbandonados: number;
  vendasRecuperadas: number;
  valorRecuperado: string;
}

function formatCurrency(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) || 0 : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`/api/dashboard/metrics?days=${days}&daily=true`)
      .then((res) => res.json())
      .then((data) => setMetrics(data))
      .catch(() => setMetrics(null));
  }, [days]);

  const valorNum = metrics ? parseFloat(metrics.valorRecuperado) || 0 : 0;
  const ticketMedio =
    metrics && metrics.vendasRecuperadas > 0
      ? valorNum / metrics.vendasRecuperadas
      : 0;

  const pieData = metrics
    ? [
        {
          name: "Checkouts iniciados",
          value: metrics.checkoutsIniciados,
          fill: "var(--loop-primary)",
        },
        {
          name: "Abandonados",
          value: metrics.carrinhosAbandonados,
          fill: "var(--loop-text-muted)",
        },
        {
          name: "Recuperados",
          value: metrics.vendasRecuperadas,
          fill: "var(--loop-success)",
        },
      ].filter((d) => d.value > 0)
    : [];

  const lineData =
    metrics?.daily?.map((d) => ({
      date: new Date(d.date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      }),
      receita: parseFloat(d.valorRecuperado) || 0,
      recuperados: d.vendasRecuperadas,
    })) ?? [];

  const kpiCards = metrics
    ? [
        {
          title: "Receita pela LoopSale",
          value: formatCurrency(metrics.valorRecuperado),
          change: null as number | null,
          subtitle: `${metrics.taxaRecuperacao}% taxa de recuperação`,
        },
        {
          title: "Ticket médio (recuperado)",
          value: formatCurrency(ticketMedio),
          change: null,
        },
        {
          title: "Checkouts iniciados",
          value: metrics.checkoutsIniciados.toLocaleString("pt-BR"),
          change: null,
        },
        {
          title: "Carrinhos abandonados",
          value: metrics.carrinhosAbandonados.toLocaleString("pt-BR"),
          change: null,
        },
        {
          title: "Vendas recuperadas",
          value: metrics.vendasRecuperadas.toLocaleString("pt-BR"),
          change: null,
        },
        {
          title: "Taxa de recuperação",
          value: `${metrics.taxaRecuperacao}%`,
          change: null,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Controles: Visão + Período */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-sm font-medium text-[var(--loop-text)]"
            defaultValue="visao-geral"
          >
            <option value="visao-geral">Visão geral</option>
          </select>
          <button
            type="button"
            className="rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-sm text-[var(--loop-text-muted)] hover:bg-[var(--loop-bg-alt)] hover:text-[var(--loop-text)]"
          >
            novo dashboard
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--loop-text-muted)]">
            Período
          </span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-sm text-[var(--loop-text)]"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </div>
      </div>

      {/* Banner destaque (estilo Martz) */}
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#4c1d95] to-[#6d28d9] text-white">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold md:text-2xl">
              Explore o impacto da recuperação no seu funil
            </h2>
            <p className="mt-1 text-sm opacity-90">
              Dados que transformam checkouts abandonados em vendas concluídas.
            </p>
            <button
              type="button"
              className="mt-4 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30"
            >
              Ver insights
            </button>
          </div>
          <div className="hidden shrink-0 md:block">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/10 text-4xl">
              📊
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="relative">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1">
              <p className="text-sm font-medium text-[var(--loop-text-muted)]">
                {kpi.title}
              </p>
              <button
                type="button"
                className="rounded p-0.5 text-[var(--loop-text-muted)] hover:bg-[var(--loop-bg-alt)] hover:text-[var(--loop-text)]"
                aria-label="Mais informações"
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[var(--loop-text)]">
                {kpi.value}
              </p>
              {kpi.subtitle && (
                <p className="mt-1 text-xs text-[var(--loop-primary)]">
                  {kpi.subtitle}
                </p>
              )}
              {kpi.change != null && (
                <p className="mt-1 flex items-center gap-1 text-xs text-[var(--loop-success)]">
                  <span className="font-medium">+{kpi.change}%</span>
                  <span className="text-[var(--loop-text-muted)]">
                    no mesmo período
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos: Pizza + Linha */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[var(--loop-text)]">
              Distribuição de checkouts
            </h2>
            <p className="text-sm text-[var(--loop-text-muted)]">
              Iniciados, abandonados e recuperados no período
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) =>
                        `${name}: ${value}`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        typeof value === "number" ? value : Number(value) || 0,
                        "",
                      ]}
                      contentStyle={{
                        background: "var(--loop-bg)",
                        border: "1px solid var(--loop-border)",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--loop-text-muted)]">
                  Conecte integrações e ative fluxos para ver dados.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Recuperados e receita por dia
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Evolução no período selecionado
              </p>
            </div>
            <select
              className="rounded border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2 py-1 text-xs text-[var(--loop-text)]"
              defaultValue="dia"
            >
              <option value="dia">Agrupar por dia</option>
            </select>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={lineData}
                    margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--loop-border)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "var(--loop-text-muted)", fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: "var(--loop-text-muted)", fontSize: 11 }}
                      tickFormatter={(v) => `R$ ${v}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: "var(--loop-text-muted)", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--loop-bg)",
                        border: "1px solid var(--loop-border)",
                        borderRadius: "8px",
                      }}
                      formatter={(value, name) => {
                        const num =
                          typeof value === "number" ? value : Number(value) || 0;
                        const n = String(name);
                        return [
                          n === "receita" ? formatCurrency(num) : num,
                          n === "receita" ? "Receita" : "Recuperados",
                        ];
                      }}
                      labelFormatter={(label) => label}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="receita"
                      name="Receita"
                      stroke="var(--loop-primary)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="recuperados"
                      name="Recuperados"
                      stroke="var(--loop-success)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--loop-text-muted)]">
                  Nenhum dado diário no período.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
