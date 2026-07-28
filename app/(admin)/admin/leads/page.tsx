"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui";

interface Lead {
  id: string;
  source: string;
  status: string;
  name: string;
  email: string;
  contato: string | null;
  negocio: string | null;
  plataforma: string | null;
  faturamento: string | null;
  clientes: string | null;
  necessidade: string | null;
  createdAt: string;
}

interface Data {
  leads: Lead[];
  counts: Record<string, number>;
  total: number;
  error?: string;
}

const STATUSES = ["novo", "contatado", "qualificado", "convertido", "descartado"];
const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  contatado: "Contatado",
  qualificado: "Qualificado",
  convertido: "Convertido",
  descartado: "Descartado",
};
const STATUS_COLOR: Record<string, string> = {
  novo: "var(--loop-primary)",
  contatado: "var(--loop-warning)",
  qualificado: "var(--loop-cta)",
  convertido: "var(--loop-success)",
  descartado: "var(--loop-text-muted)",
};
const FATURAMENTO_LABEL: Record<string, string> = {
  "ate-50k": "Até R$ 50k",
  "50k-250k": "R$ 50k–250k",
  "250k-500k": "R$ 250k–500k",
  "500k-1mi": "R$ 500k–1mi",
  "acima-1mi": "Acima de R$ 1mi",
};
const PLATAFORMA_LABEL: Record<string, string> = {
  kiwify: "Kiwify",
  hotmart: "Hotmart",
  outro: "Outro",
};

function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdminLeadsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/leads");
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    setSaving(id);
    // Atualiza otimista.
    setData((d) =>
      d
        ? { ...d, leads: d.leads.map((l) => (l.id === id ? { ...l, status } : l)) }
        : d
    );
    try {
      await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
    } finally {
      setSaving(null);
      // Recarrega os contadores.
      load();
    }
  }

  if (denied) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">Leads</h1>
        <p className="mt-2 text-sm text-[var(--loop-error)]">
          Acesso restrito ao time da LoopSale.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">
          Leads de demonstração
        </h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Solicitações do formulário de demonstração (funil comercial da LoopSale).
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>
      ) : !data ? (
        <p className="text-sm text-[var(--loop-text-muted)]">
          Não foi possível carregar.
        </p>
      ) : (
        <>
          {/* Contadores por status */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-[var(--loop-text-muted)]">Total</p>
                <p className="mt-1 text-2xl font-bold text-[var(--loop-text)]">
                  {data.total}
                </p>
              </CardContent>
            </Card>
            {STATUSES.map((s) => (
              <Card key={s}>
                <CardContent className="py-4">
                  <p className="text-xs text-[var(--loop-text-muted)]">
                    {STATUS_LABEL[s]}
                  </p>
                  <p
                    className="mt-1 text-2xl font-bold"
                    style={{ color: STATUS_COLOR[s] }}
                  >
                    {data.counts?.[s] ?? 0}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabela */}
          <Card>
            <CardContent className="p-0">
              {data.leads.length === 0 ? (
                <p className="p-6 text-sm text-[var(--loop-text-muted)]">
                  Nenhuma solicitação de demonstração ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--loop-border)] text-left text-xs uppercase tracking-wide text-[var(--loop-text-muted)]">
                        <th className="px-4 py-3 font-medium">Data</th>
                        <th className="px-4 py-3 font-medium">Nome</th>
                        <th className="px-4 py-3 font-medium">Contato</th>
                        <th className="px-4 py-3 font-medium">Negócio</th>
                        <th className="px-4 py-3 font-medium">Plataforma</th>
                        <th className="px-4 py-3 font-medium">Faturamento</th>
                        <th className="px-4 py-3 font-medium">Necessidade</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leads.map((l) => (
                        <tr
                          key={l.id}
                          className="border-b border-[var(--loop-border)] align-top last:border-0"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-[var(--loop-text-muted)]">
                            {dataBR(l.createdAt)}
                          </td>
                          <td className="px-4 py-3 font-medium text-[var(--loop-text)]">
                            {l.name}
                          </td>
                          <td className="px-4 py-3 text-[var(--loop-text-muted)]">
                            <div>{l.email}</div>
                            {l.contato && <div>{l.contato}</div>}
                          </td>
                          <td className="px-4 py-3 text-[var(--loop-text)]">
                            {l.negocio || "—"}
                            {l.clientes && (
                              <div className="text-xs text-[var(--loop-text-muted)]">
                                {l.clientes} clientes/leads
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[var(--loop-text-muted)]">
                            {l.plataforma
                              ? PLATAFORMA_LABEL[l.plataforma] ?? l.plataforma
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-[var(--loop-text-muted)]">
                            {l.faturamento
                              ? FATURAMENTO_LABEL[l.faturamento] ?? l.faturamento
                              : "—"}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-[var(--loop-text-muted)]">
                            {l.necessidade || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={l.status}
                              disabled={saving === l.id}
                              onChange={(e) => updateStatus(l.id, e.target.value)}
                              className="rounded-md border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2 py-1 text-sm text-[var(--loop-text)]"
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
