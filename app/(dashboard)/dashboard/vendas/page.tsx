"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

interface Sale {
  id: string;
  recoveredAt: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  productName: string | null;
  amount: string | null;
  currency: string;
  fees: string | null;
  affiliate: string | null;
  recoveryType: string;
  commissionPaidKiwify: boolean;
}

interface DailyRow {
  date: string;
  count: number;
  valorBrl: number;
  valorUsd: number;
}

interface SalesResponse {
  sales: Sale[];
  total: number;
  summary: { count: number; valorBrl: number; valorUsd: number };
  daily: DailyRow[];
  affiliates: string[];
  products: string[];
}

const PAGE_SIZE = 25;

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v || 0);
}
function formatUSD(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(v || 0);
}
function formatValue(amount: string | null, currency: string): string {
  const n = parseFloat(amount ?? "0") || 0;
  return currency?.toUpperCase() === "USD" ? formatUSD(n) : formatBRL(n);
}
function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDay(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function VendasPage() {
  const [data, setData] = useState<SalesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(isoDaysAgo(90));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [affiliate, setAffiliate] = useState("");
  const [product, setProduct] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [from, to, affiliate, product, search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (affiliate) params.set("affiliate", affiliate);
    if (product) params.set("product", product);
    if (search) params.set("search", search);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));

    setLoading(true);
    try {
      const res = await fetch(`/api/sales?${params}`);
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, affiliate, product, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">Vendas</h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Vendas recuperadas pela LoopSale — consulte por período, afiliado ou
          produto.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-[var(--loop-text-muted)]">
              Vendas recuperadas
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--loop-text)]">
              {(data?.summary.count ?? 0).toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-[var(--loop-text-muted)]">Total em R$</p>
            <p className="mt-1 text-2xl font-bold text-[var(--loop-success)]">
              {formatBRL(data?.summary.valorBrl ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-[var(--loop-text-muted)]">Total em US$</p>
            <p className="mt-1 text-2xl font-bold text-[var(--loop-success)]">
              {formatUSD(data?.summary.valorUsd ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">Filtros</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="De"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              label="Até"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                Afiliado
              </label>
              <select
                value={affiliate}
                onChange={(e) => setAffiliate(e.target.value)}
                className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
              >
                <option value="">Todos os afiliados</option>
                {(data?.affiliates ?? []).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                Produto
              </label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
              >
                <option value="">Todos os produtos</option>
                {(data?.products ?? []).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Buscar cliente (email/telefone)"
              type="search"
              placeholder="email ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Resumo por dia */}
      {data && data.daily.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[var(--loop-text)]">
              Resumo por dia
            </h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                    <th className="pb-2 pr-4 font-medium">Dia</th>
                    <th className="pb-2 pr-4 font-medium">Vendas</th>
                    <th className="pb-2 pr-4 font-medium">Total R$</th>
                    <th className="pb-2 font-medium">Total US$</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((d) => (
                    <tr
                      key={d.date}
                      className="border-b border-[var(--loop-border)]"
                    >
                      <td className="py-2 pr-4 text-[var(--loop-text)]">
                        {formatDay(d.date)}
                      </td>
                      <td className="py-2 pr-4 text-[var(--loop-text)]">
                        {d.count}
                      </td>
                      <td className="py-2 pr-4 text-[var(--loop-text)]">
                        {formatBRL(d.valorBrl)}
                      </td>
                      <td className="py-2 text-[var(--loop-text)]">
                        {formatUSD(d.valorUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalhe */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Vendas detalhadas
          </h2>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <p className="py-8 text-center text-sm text-[var(--loop-text-muted)]">
              Carregando…
            </p>
          ) : !data || data.sales.length === 0 ? (
            <p className="py-8 text-center text-[var(--loop-text-muted)]">
              Nenhuma venda recuperada nesse período/filtro.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                      <th className="pb-2 pr-4 font-medium">Data</th>
                      <th className="pb-2 pr-4 font-medium">Cliente</th>
                      <th className="pb-2 pr-4 font-medium">Produto</th>
                      <th className="pb-2 pr-4 font-medium">Valor</th>
                      <th className="pb-2 pr-4 font-medium">Afiliado</th>
                      <th className="pb-2 pr-4 font-medium">Comissão</th>
                      <th className="pb-2 font-medium">Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-[var(--loop-border)]"
                      >
                        <td className="py-3 pr-4 text-[var(--loop-text-muted)]">
                          {formatDate(s.recoveredAt)}
                        </td>
                        <td className="py-3 pr-4 text-[var(--loop-text)]">
                          {s.customerEmail ?? s.customerPhone ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-[var(--loop-text)]">
                          {s.productName ?? "—"}
                        </td>
                        <td className="py-3 pr-4 font-medium text-[var(--loop-text)]">
                          {formatValue(s.amount, s.currency)}
                        </td>
                        <td className="py-3 pr-4 text-[var(--loop-text)]">
                          {s.affiliate || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={
                              s.commissionPaidKiwify ? "default" : "success"
                            }
                          >
                            {s.commissionPaidKiwify
                              ? "Paga na Kiwify"
                              : "LoopSale 40%"}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              s.recoveryType === "refused" ? "cta" : "warning"
                            }
                          >
                            {s.recoveryType === "refused"
                              ? "Recusado"
                              : "Abandonado"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-[var(--loop-text-muted)]">
                  {rangeStart}–{rangeEnd} de {total.toLocaleString("pt-BR")}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-[var(--loop-text-muted)]">
                    Página {page + 1} de {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
