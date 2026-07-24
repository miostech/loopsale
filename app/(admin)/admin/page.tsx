"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";

interface Empresa {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  planoNome: string;
  rate: number;
  criadoEm: string;
  cardOnFile: boolean;
  membros: number;
  recuperadoQuinzena: number;
  aReceberQuinzena: number;
  recebido: number;
  emAberto: number;
}

interface Overview {
  periodo: string;
  totals: {
    empresas: number;
    aReceber: number;
    recebido: number;
    emAberto: number;
    recuperadoBrl: number;
  };
  empresas: Empresa[];
  error?: string;
}

function money(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v || 0);
}
function data(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function AdminPage() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/overview");
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      setOv(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (denied) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">Admin</h1>
        <p className="mt-2 text-sm text-[var(--loop-error)]">
          Acesso restrito ao time da LoopSale.
        </p>
      </div>
    );
  }

  const tiles = ov
    ? [
        { label: "Empresas clientes", value: String(ov.totals.empresas), accent: "var(--loop-text)" },
        { label: "A receber (quinzena)", value: money(ov.totals.aReceber), accent: "var(--loop-primary)" },
        { label: "Já recebido", value: money(ov.totals.recebido), accent: "var(--loop-success)" },
        { label: "Em aberto", value: money(ov.totals.emAberto), accent: "var(--loop-error)" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">
          Painel LoopSale (admin)
        </h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Todas as empresas clientes e as comissões que vamos receber.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>
      ) : !ov ? (
        <p className="text-sm text-[var(--loop-text-muted)]">
          Não foi possível carregar.
        </p>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <Card key={t.label}>
                <CardContent className="py-4">
                  <p className="text-xs text-[var(--loop-text-muted)]">
                    {t.label}
                  </p>
                  <p
                    className="mt-1 text-2xl font-bold"
                    style={{ color: t.accent }}
                  >
                    {t.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empresas */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Empresas clientes
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Comissão a receber é a apuração parcial da quinzena atual.
              </p>
            </CardHeader>
            <CardContent>
              {ov.empresas.length === 0 ? (
                <p className="text-sm text-[var(--loop-text-muted)]">
                  Nenhuma empresa ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                        <th className="pb-2 pr-4 font-medium">Empresa</th>
                        <th className="pb-2 pr-4 font-medium">Plano</th>
                        <th className="pb-2 pr-4 font-medium">Cadastro</th>
                        <th className="pb-2 pr-4 font-medium">Cartão</th>
                        <th className="pb-2 pr-4 font-medium">
                          Recuperado (quinzena)
                        </th>
                        <th className="pb-2 pr-4 font-medium">A receber</th>
                        <th className="pb-2 pr-4 font-medium">Recebido</th>
                        <th className="pb-2 font-medium">Em aberto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ov.empresas.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b border-[var(--loop-border)] hover:bg-[var(--loop-bg-alt)]"
                        >
                          <td className="py-2 pr-4 font-medium">
                            <Link
                              href={`/admin/empresa/${e.id}`}
                              className="text-[var(--loop-primary)] hover:underline"
                            >
                              {e.nome}
                            </Link>
                            <span className="ml-2 text-xs text-[var(--loop-text-muted)]">
                              {e.membros} usuário{e.membros === 1 ? "" : "s"}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant="default">
                              {e.planoNome}
                              {e.rate > 0
                                ? ` · ${Math.round(e.rate * 100)}%`
                                : ""}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 text-[var(--loop-text-muted)]">
                            {data(e.criadoEm)}
                          </td>
                          <td className="py-2 pr-4">
                            {e.cardOnFile ? (
                              <Badge variant="success">Sim</Badge>
                            ) : (
                              <Badge variant="warning">Não</Badge>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-[var(--loop-text)]">
                            {money(e.recuperadoQuinzena)}
                          </td>
                          <td className="py-2 pr-4 font-semibold text-[var(--loop-primary)]">
                            {money(e.aReceberQuinzena)}
                          </td>
                          <td className="py-2 pr-4 text-[var(--loop-success)]">
                            {money(e.recebido)}
                          </td>
                          <td className="py-2">
                            {e.emAberto > 0 ? (
                              <span className="text-[var(--loop-error)]">
                                {money(e.emAberto)}
                              </span>
                            ) : (
                              <span className="text-[var(--loop-text-muted)]">
                                —
                              </span>
                            )}
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
