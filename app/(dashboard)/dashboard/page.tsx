"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface Segment {
  total: number;
  recuperados: number;
  valorEmRisco: string;
  valorRecuperado: string;
  taxa: number;
}

interface Variation {
  valorRecuperado: number | null;
  vendasRecuperadas: number | null;
  taxaRecuperacao: number | null;
  valorEmRisco: number | null;
}

interface Metrics {
  periodoDias: number;
  checkoutsIniciados: number;
  mensagensEnviadas: number;
  abordados: number;
  abandonados: Segment;
  recusados: Segment;
  total: Segment;
  variacao: Variation;
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

function pct(value: number, base: number): number {
  return base > 0 ? Math.round((value / base) * 100) : 0;
}

/** Badge de variação vs período anterior. */
function ChangeBadge({
  value,
  goodWhenUp = true,
}: {
  value: number | null;
  goodWhenUp?: boolean;
}) {
  if (value == null) return null;
  const isUp = value > 0;
  const isFlat = value === 0;
  const positive = goodWhenUp ? isUp : !isUp && !isFlat;
  const color = isFlat
    ? "var(--loop-text-muted)"
    : positive
      ? "var(--loop-success)"
      : "var(--loop-error)";
  const arrow = isFlat ? "" : isUp ? "▲" : "▼";
  return (
    <span className="mt-1 flex items-center gap-1 text-xs" style={{ color }}>
      <span className="font-medium">
        {arrow} {isUp ? "+" : ""}
        {value}%
      </span>
      <span className="text-[var(--loop-text-muted)]">vs período anterior</span>
    </span>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/metrics?days=${days}&daily=true`)
      .then((res) => res.json())
      .then((data) => setMetrics(data))
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, [days]);

  const valorRecuperadoNum = metrics
    ? parseFloat(metrics.total.valorRecuperado) || 0
    : 0;
  const ticketMedio =
    metrics && metrics.total.recuperados > 0
      ? valorRecuperadoNum / metrics.total.recuperados
      : 0;

  const lineData =
    metrics?.daily?.map((d) => ({
      date: new Date(d.date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      }),
      receita: parseFloat(d.valorRecuperado) || 0,
      recuperados: d.vendasRecuperadas,
    })) ?? [];

  // Estágios do funil de recuperação.
  const funnel = metrics
    ? [
        {
          label: "Checkouts iniciados",
          value: metrics.checkoutsIniciados,
          color: "var(--loop-primary)",
          conv: null as number | null,
        },
        {
          label: "Recuperáveis (abandonado + recusado)",
          value: metrics.total.total,
          color: "var(--loop-warning)",
          conv: pct(metrics.total.total, metrics.checkoutsIniciados),
        },
        {
          label: "Abordados (receberam WhatsApp)",
          value: metrics.abordados,
          color: "var(--loop-cta)",
          conv: pct(metrics.abordados, metrics.total.total),
        },
        {
          label: "Recuperados (voltaram a comprar)",
          value: metrics.total.recuperados,
          color: "var(--loop-success)",
          conv: pct(metrics.total.recuperados, metrics.abordados),
        },
      ]
    : [];
  const funnelMax = funnel.length ? Math.max(...funnel.map((f) => f.value), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Período */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[var(--loop-text)]">
            Visão geral da recuperação
          </h1>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Quanto entrou, quanto foi abordado e quanto voltou a comprar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--loop-text-muted)]">Período</span>
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

      {loading && !metrics ? (
        <div className="py-20 text-center text-sm text-[var(--loop-text-muted)]">
          Carregando métricas…
        </div>
      ) : !metrics ? (
        <div className="py-20 text-center text-sm text-[var(--loop-text-muted)]">
          Não foi possível carregar as métricas.
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-1">
                <p className="text-sm font-medium text-[var(--loop-text-muted)]">
                  Receita recuperada
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--loop-text)]">
                  {formatCurrency(metrics.total.valorRecuperado)}
                </p>
                <ChangeBadge value={metrics.variacao.valorRecuperado} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <p className="text-sm font-medium text-[var(--loop-text-muted)]">
                  Valor em risco
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--loop-text)]">
                  {formatCurrency(metrics.total.valorEmRisco)}
                </p>
                <p className="mt-1 text-xs text-[var(--loop-text-muted)]">
                  Total recuperável no período
                </p>
                <ChangeBadge
                  value={metrics.variacao.valorEmRisco}
                  goodWhenUp={false}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <p className="text-sm font-medium text-[var(--loop-text-muted)]">
                  Taxa de recuperação
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--loop-text)]">
                  {metrics.total.taxa}%
                </p>
                <p className="mt-1 text-xs text-[var(--loop-text-muted)]">
                  {metrics.total.recuperados} de {metrics.total.total}{" "}
                  recuperáveis
                </p>
                <ChangeBadge value={metrics.variacao.taxaRecuperacao} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <p className="text-sm font-medium text-[var(--loop-text-muted)]">
                  Ticket médio recuperado
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[var(--loop-text)]">
                  {formatCurrency(ticketMedio)}
                </p>
                <p className="mt-1 text-xs text-[var(--loop-text-muted)]">
                  {metrics.mensagensEnviadas.toLocaleString("pt-BR")} mensagens
                  enviadas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Funil de recuperação */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Funil de recuperação
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Do checkout iniciado até a venda recuperada
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnel.map((stage) => (
                <div key={stage.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-[var(--loop-text)]">
                      {stage.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--loop-text)]">
                        {stage.value.toLocaleString("pt-BR")}
                      </span>
                      {stage.conv != null && (
                        <span className="text-xs text-[var(--loop-text-muted)]">
                          ({stage.conv}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--loop-bg-alt)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(2, (stage.value / funnelMax) * 100)}%`,
                        background: stage.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recusados vs Abandonados */}
          <div className="grid gap-6 lg:grid-cols-2">
            <SegmentCard
              title="Carrinhos abandonados"
              subtitle="Checkout iniciado e não concluído"
              accent="var(--loop-warning)"
              seg={metrics.abandonados}
            />
            <SegmentCard
              title="Pagamentos recusados"
              subtitle="Tentou pagar e o cartão/pix falhou"
              accent="var(--loop-cta)"
              seg={metrics.recusados}
            />
          </div>

          {/* Evolução diária */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Recuperados e receita por dia
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Evolução no período selecionado
              </p>
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
                            typeof value === "number"
                              ? value
                              : Number(value) || 0;
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
        </>
      )}
    </div>
  );
}

function SegmentCard({
  title,
  subtitle,
  accent,
  seg,
}: {
  title: string;
  subtitle: string;
  accent: string;
  seg: Segment;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <h2 className="font-semibold text-[var(--loop-text)]">{title}</h2>
          <p className="text-sm text-[var(--loop-text-muted)]">{subtitle}</p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
          style={{ background: accent }}
        >
          {seg.taxa}% recuperado
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Total" value={seg.total.toLocaleString("pt-BR")} />
          <Stat
            label="Recuperados"
            value={seg.recuperados.toLocaleString("pt-BR")}
          />
          <Stat label="Valor em risco" value={formatCurrency(seg.valorEmRisco)} />
          <Stat
            label="Valor recuperado"
            value={formatCurrency(seg.valorRecuperado)}
            highlight
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-[var(--loop-text-muted)]">{label}</p>
      <p
        className={`text-lg font-semibold ${
          highlight
            ? "text-[var(--loop-success)]"
            : "text-[var(--loop-text)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
