"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { Badge } from "@/components/ui";

interface Lead {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  status: string;
  source: string;
  lastContactedAt: string | null;
  updatedAt: string;
}

const PAGE_SIZE = 20;

// Rótulos amigáveis em português.
const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  hot: "Quente",
  purchased: "Comprou",
  paid: "Pago",
};

const STATUS_VARIANT: Record<string, "default" | "cta" | "success"> = {
  purchased: "success",
  hot: "cta",
  lead: "default",
  // Pago (venda direta, sem passar pelo funil) fica cinza — já foi finalizado.
  paid: "default",
};

const SOURCE_LABELS: Record<string, string> = {
  checkout: "Checkout",
  approved: "Aprovado",
  whatsapp: "WhatsApp",
  manual: "Manual",
};

const STATUS_FILTERS = [
  { value: "", label: "Todos os status" },
  { value: "lead", label: "Lead" },
  { value: "purchased", label: "Comprou" },
  { value: "paid", label: "Pago" },
  { value: "hot", label: "Quente" },
];

const SOURCE_FILTERS = [
  { value: "", label: "Todas as origens" },
  { value: "checkout", label: "Checkout" },
  { value: "approved", label: "Aprovado" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "manual", label: "Manual" },
];

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [baseTotal, setBaseTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Volta para a primeira página sempre que um filtro muda.
  useEffect(() => {
    setPage(0);
  }, [search, status, source]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));

    setLoading(true);
    fetch(`/api/leads?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setLeads(data.leads ?? []);
        setTotal(data.total ?? 0);
        setBaseTotal(data.baseTotal ?? 0);
        setStatusCounts(data.statusCounts ?? {});
      })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [search, status, source, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  const summary = [
    { label: "Total de clientes", value: baseTotal, accent: "var(--loop-text)" },
    {
      label: "Recuperados",
      value: statusCounts.purchased ?? 0,
      accent: "var(--loop-success)",
    },
    {
      label: "Pagos (direto)",
      value: statusCounts.paid ?? 0,
      accent: "var(--loop-text-muted)",
    },
    {
      label: "Leads",
      value: statusCounts.lead ?? 0,
      accent: "var(--loop-primary)",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">Clientes</h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Contatos capturados via checkout e WhatsApp, com status e origem.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <p className="text-sm text-[var(--loop-text-muted)]">{s.label}</p>
              <p
                className="mt-1 text-2xl font-bold"
                style={{ color: s.accent }}
              >
                {s.value.toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <h2 className="font-semibold text-[var(--loop-text)]">
            Base de clientes
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="search"
              placeholder="Buscar por email, telefone ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full flex-1 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-sm text-[var(--loop-text)] placeholder:text-[var(--loop-text-muted)] sm:max-w-xs"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-sm text-[var(--loop-text)]"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-sm text-[var(--loop-text)]"
            >
              {SOURCE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading && leads.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--loop-text-muted)]">
              Carregando…
            </p>
          ) : leads.length === 0 ? (
            <p className="py-8 text-center text-[var(--loop-text-muted)]">
              {search || status || source
                ? "Nenhum cliente encontrado com esses filtros."
                : "Nenhum cliente ainda. Os contatos aparecerão aqui após eventos de checkout e mensagens enviadas."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                      <th className="pb-2 pr-4 font-medium">Contato</th>
                      <th className="pb-2 pr-4 font-medium">Nome</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Origem</th>
                      <th className="pb-2 pr-4 font-medium">Último contato</th>
                      <th className="pb-2 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="border-b border-[var(--loop-border)] hover:bg-[var(--loop-bg-alt)]"
                      >
                        <td className="py-3 pr-4">
                          <div className="text-[var(--loop-text)]">
                            {lead.email ?? "—"}
                          </div>
                          {lead.phone && (
                            <div className="text-xs text-[var(--loop-text-muted)]">
                              {lead.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[var(--loop-text)]">
                          {lead.name ?? "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={STATUS_VARIANT[lead.status] ?? "default"}>
                            {statusLabel(lead.status)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-[var(--loop-text)]">
                          {sourceLabel(lead.source)}
                        </td>
                        <td className="py-3 pr-4 text-[var(--loop-text-muted)]">
                          {formatDateTime(lead.lastContactedAt)}
                        </td>
                        <td className="py-3">
                          <Link
                            href={`/dashboard/clientes/${lead.id}`}
                            className="text-[var(--loop-primary)] hover:underline"
                          >
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-[var(--loop-text-muted)]">
                  {rangeStart}–{rangeEnd} de {total.toLocaleString("pt-BR")}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-1.5 text-[var(--loop-text)] disabled:opacity-40 enabled:hover:bg-[var(--loop-bg-alt)]"
                  >
                    Anterior
                  </button>
                  <span className="text-[var(--loop-text-muted)]">
                    Página {page + 1} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                    className="rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-1.5 text-[var(--loop-text)] disabled:opacity-40 enabled:hover:bg-[var(--loop-bg-alt)]"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
