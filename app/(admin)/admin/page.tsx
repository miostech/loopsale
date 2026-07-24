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
  assinaturaMensal: number;
  mensagens: number;
  custoMeta: number;
  custoMetaEur: number;
  margem: number;
  ultimaAtividade: string | null;
  ativo: boolean;
}

interface Overview {
  periodo: string;
  metaCostEur: number;
  eurRate: number;
  totals: {
    empresas: number;
    ativos: number;
    inativos: number;
    aReceber: number;
    recebido: number;
    emAberto: number;
    mrr: number;
    custoMeta: number;
    custoMetaEur: number;
    margem: number;
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
function eur(v: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(v || 0);
}
function haQuanto(iso: string | null): string {
  if (!iso) return "sem eventos";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
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

  const t = ov?.totals;
  const tiles = t
    ? [
        { label: "Empresas clientes", value: String(t.empresas), accent: "var(--loop-text)" },
        {
          label: "Ativas · inativas",
          value: `${t.ativos} · ${t.inativos}`,
          accent: t.inativos > 0 ? "var(--loop-warning)" : "var(--loop-success)",
        },
        { label: "MRR (assinaturas)", value: money(t.mrr), accent: "var(--loop-cta)" },
        { label: "A receber (quinzena)", value: money(t.aReceber), accent: "var(--loop-primary)" },
        { label: "Já recebido", value: money(t.recebido), accent: "var(--loop-success)" },
        { label: "Em aberto", value: money(t.emAberto), accent: "var(--loop-error)" },
        { label: "Custo Meta (mensagens)", value: eur(t.custoMetaEur), accent: "var(--loop-text-muted)" },
        {
          label: "Margem (comissão − Meta)",
          value: money(t.margem),
          accent: t.margem >= 0 ? "var(--loop-success)" : "var(--loop-error)",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">
          Painel LoopSale (admin)
        </h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Empresas clientes, receita (assinatura + comissão), custo Meta e saúde.
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
          {/* Resumo da plataforma */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((tile) => (
              <Card key={tile.label}>
                <CardContent className="py-4">
                  <p className="text-xs text-[var(--loop-text-muted)]">
                    {tile.label}
                  </p>
                  <p
                    className="mt-1 text-2xl font-bold"
                    style={{ color: tile.accent }}
                  >
                    {tile.value}
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
                Comissão a receber = apuração parcial da quinzena. Custo Meta ={" "}
                {eur(ov.metaCostEur)}/mensagem (câmbio €→R$ {ov.eurRate}). Clique
                numa empresa para o detalhe.
              </p>
            </CardHeader>
            <CardContent>
              {ov.empresas.length === 0 ? (
                <p className="text-sm text-[var(--loop-text-muted)]">
                  Nenhuma empresa ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-sm">
                    <thead>
                      <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                        <th className="pb-2 pr-4 font-medium">Empresa</th>
                        <th className="pb-2 pr-4 font-medium">Plano</th>
                        <th className="pb-2 pr-4 font-medium">Assinatura/mês</th>
                        <th className="pb-2 pr-4 font-medium">Mensagens</th>
                        <th className="pb-2 pr-4 font-medium">A receber</th>
                        <th className="pb-2 pr-4 font-medium">Recebido</th>
                        <th className="pb-2 pr-4 font-medium">Em aberto</th>
                        <th className="pb-2 pr-4 font-medium">Margem</th>
                        <th className="pb-2 font-medium">Cartão</th>
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
                            {!e.ativo && (
                              <Badge variant="warning" className="ml-2">
                                inativa
                              </Badge>
                            )}
                            <span className="block text-xs text-[var(--loop-text-muted)]">
                              {e.membros} usuário{e.membros === 1 ? "" : "s"} ·
                              ativo {haQuanto(e.ultimaAtividade)}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant="default">
                              {e.planoNome}
                              {e.rate > 0 ? ` · ${Math.round(e.rate * 100)}%` : ""}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 text-[var(--loop-text)]">
                            {e.assinaturaMensal > 0 ? money(e.assinaturaMensal) : "—"}
                          </td>
                          <td className="py-2 pr-4 text-[var(--loop-text)]">
                            {e.mensagens.toLocaleString("pt-BR")}
                            <span className="block text-xs text-[var(--loop-text-muted)]">
                              {eur(e.custoMetaEur)} Meta
                            </span>
                          </td>
                          <td className="py-2 pr-4 font-semibold text-[var(--loop-primary)]">
                            {money(e.aReceberQuinzena)}
                          </td>
                          <td className="py-2 pr-4 text-[var(--loop-success)]">
                            {money(e.recebido)}
                          </td>
                          <td className="py-2 pr-4">
                            {e.emAberto > 0 ? (
                              <span className="text-[var(--loop-error)]">
                                {money(e.emAberto)}
                              </span>
                            ) : (
                              <span className="text-[var(--loop-text-muted)]">—</span>
                            )}
                          </td>
                          <td
                            className="py-2 pr-4 font-medium"
                            style={{
                              color:
                                e.margem >= 0
                                  ? "var(--loop-success)"
                                  : "var(--loop-error)",
                            }}
                          >
                            {money(e.margem)}
                          </td>
                          <td className="py-2">
                            {e.cardOnFile ? (
                              <Badge variant="success">Sim</Badge>
                            ) : (
                              <Badge variant="warning">Não</Badge>
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
