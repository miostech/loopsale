"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";

interface Detalhe {
  empresa: {
    id: string;
    nome: string;
    slug: string;
    plano: string;
    planoNome: string;
    rate: number;
    criadoEm: string;
    cardOnFile: boolean;
    membros: number;
    assinaturaMensal: number;
    ultimaAtividade: string | null;
  };
  quinzena: {
    periodKey: string;
    recuperadoBrl: number;
    recuperadoUsd: number;
    baseBrl: number;
    comissaoBrl: number;
    comissaoRealBrl: number;
    comissaoUsd: number;
    pagaKiwifyBrl: number;
    pagaKiwifyUsd: number;
    retidaBrl: number;
  };
  totais: {
    recebido: number;
    emAberto: number;
    recuperadoTotalBrl: number;
    recuperadoTotalUsd: number;
    recuperadoViaKiwifyBrl: number;
    recuperadoViaKiwifyUsd: number;
    recuperadasTotal: number;
    recuperaveisTotal: number;
    taxaConversao: number;
    taxaPorMensagem: number;
    mensagensTotal: number;
    mensagensQuinzena: number;
    custoMeta: number;
    custoMetaEur: number;
    margem: number;
  };
  historico: {
    id: string;
    periodKey: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    comissaoBrl: number;
    baseBrl: number;
    status: string;
  }[];
  error?: string;
}

const CHARGE_STATUS: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "error" }
> = {
  paid: { label: "Pago", variant: "success" },
  invoiced: { label: "Em aberto", variant: "warning" },
  pending: { label: "Em aberto", variant: "warning" },
  no_card: { label: "Sem cartão", variant: "error" },
  failed: { label: "Débito falhou — em aberto", variant: "error" },
  zero: { label: "Sem cobrança", variant: "default" },
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v || 0
  );
const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    v || 0
  );
const eur = (v: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    v || 0
  );
const dataBR = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

/** Há quanto tempo aconteceu algo (última atividade). */
function haQuanto(iso?: string | null): string {
  if (!iso) return "sem eventos";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

/** Há quanto tempo é cliente (a partir da data de cadastro). */
function tempoCliente(iso?: string | null): string {
  if (!iso) return "";
  const dias = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  );
  if (dias === 0) return "cadastrado hoje";
  if (dias === 1) return "cliente há 1 dia";
  if (dias < 60) return `cliente há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses < 24) return `cliente há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(dias / 365);
  return `cliente há ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

function periodo(row: Detalhe["historico"][number]): string {
  if (row.periodStart && row.periodEnd) {
    const dm = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${dm(new Date(row.periodStart))} – ${dm(
      new Date(new Date(row.periodEnd).getTime() - 86400000)
    )}`;
  }
  return row.periodKey;
}

export default function EmpresaDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [d, setD] = useState<Detalhe | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/empresa/${id}`);
      setD(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>;
  }
  if (!d || d.error || !d.empresa) {
    return (
      <div>
        <Link href="/admin" className="text-sm text-[var(--loop-primary)] hover:underline">
          ← Voltar
        </Link>
        <p className="mt-2 text-sm text-[var(--loop-error)]">
          {d?.error ?? "Empresa não encontrada."}
        </p>
      </div>
    );
  }

  const { empresa: e, quinzena: q, totais: t } = d;

  const cardQuinzena: {
    label: string;
    value: string;
    sub?: string;
    accent: string;
  }[] = [
    {
      label: "Recuperado (base)",
      value: brl(q.recuperadoBrl),
      sub: usd(q.recuperadoUsd),
      accent: "var(--loop-text)",
    },
    {
      label: "A receber (total no cartão)",
      value: brl(q.comissaoBrl),
      sub:
        q.comissaoUsd > 0
          ? `${brl(q.comissaoRealBrl)} real + ${usd(q.comissaoUsd)} dólar`
          : undefined,
      accent: "var(--loop-primary)",
    },
    {
      label: "Comissão via Kiwify/Hotmart",
      value: brl(q.pagaKiwifyBrl),
      sub: usd(q.pagaKiwifyUsd),
      accent: "var(--loop-text-muted)",
    },
  ];
  if (q.retidaBrl > 0)
    cardQuinzena.push({
      label: "Retida (reembolso vendedor)",
      value: brl(q.retidaBrl),
      accent: "var(--loop-warning)",
    });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-[var(--loop-primary)] hover:underline">
          ← Todas as empresas
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-[var(--loop-text)]">
          {e.nome}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--loop-text-muted)]">
          <Badge variant="default">
            {e.planoNome}
            {e.rate > 0 ? ` · ${Math.round(e.rate * 100)}%` : ""}
          </Badge>
          <span>
            · Cadastro {dataBR(e.criadoEm)} ({tempoCliente(e.criadoEm)})
          </span>
          <span>· {e.membros} usuário{e.membros === 1 ? "" : "s"}</span>
          {e.assinaturaMensal > 0 && (
            <span>· Assinatura {brl(e.assinaturaMensal)}/mês</span>
          )}
          <span>· ativo {haQuanto(e.ultimaAtividade)}</span>
          <span>·</span>
          {e.cardOnFile ? (
            <Badge variant="success">Cartão cadastrado</Badge>
          ) : (
            <Badge variant="warning">Sem cartão</Badge>
          )}
          {(() => {
            const dias = e.ultimaAtividade
              ? Math.floor(
                  (Date.now() - new Date(e.ultimaAtividade).getTime()) / 86400000
                )
              : Infinity;
            return dias > 7 ? (
              <Badge variant="error">integração parada?</Badge>
            ) : null;
          })()}
        </div>
      </div>

      {/* Quinzena atual */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Quinzena atual (parcial)
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Apuração {q.periodKey} — o que vamos receber ao fechar a quinzena.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cardQuinzena.map((c) => (
              <div
                key={c.label}
                className="rounded-lg border border-[var(--loop-border)] p-3"
              >
                <p className="text-xs text-[var(--loop-text-muted)]">{c.label}</p>
                <p
                  className="mt-1 text-xl font-bold"
                  style={{ color: c.accent }}
                >
                  {c.value}
                </p>
                {c.sub && (
                  <p
                    className="mt-0.5 text-xs font-medium"
                    style={{ color: c.accent }}
                  >
                    {c.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Acumulado */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">Acumulado</h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Todo o histórico desde o cadastro.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--loop-success)] bg-emerald-50 p-3 dark:bg-emerald-900/20">
              <p className="text-xs text-[var(--loop-success)]">
                Taxa de conversão
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--loop-success)]">
                {Math.round(t.taxaConversao * 100)}%
              </p>
              <p className="mt-0.5 text-xs text-[var(--loop-success)]">
                {t.recuperadasTotal} de {t.recuperaveisTotal} recuperáveis
              </p>
            </div>
            <div className="rounded-lg border border-[var(--loop-border)] p-3">
              <p className="text-xs text-[var(--loop-text-muted)]">
                Recuperado total
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--loop-text)]">
                {brl(t.recuperadoTotalBrl)}
              </p>
              {t.recuperadoTotalUsd > 0 && (
                <p className="text-xs text-[var(--loop-text-muted)]">
                  {usd(t.recuperadoTotalUsd)}
                </p>
              )}
              <p className="mt-0.5 text-xs text-[var(--loop-text-muted)]">
                {t.recuperadasTotal} venda{t.recuperadasTotal === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--loop-border)] p-3">
              <p className="text-xs text-[var(--loop-text-muted)]">
                Comissão recebida
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--loop-success)]">
                {brl(t.recebido)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--loop-border)] p-3">
              <p className="text-xs text-[var(--loop-text-muted)]">Em aberto</p>
              <p className="mt-1 text-xl font-bold text-[var(--loop-error)]">
                {brl(t.emAberto)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--loop-border)] p-3">
              <p className="text-xs text-[var(--loop-text-muted)]">
                Recuperado via Kiwify/Hotmart
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--loop-text-muted)]">
                {brl(t.recuperadoViaKiwifyBrl)}
              </p>
              {t.recuperadoViaKiwifyUsd > 0 && (
                <p className="text-sm font-medium text-[var(--loop-text-muted)]">
                  {usd(t.recuperadoViaKiwifyUsd)}
                </p>
              )}
              <p className="mt-0.5 text-xs text-[var(--loop-text-muted)]">
                comissão já paga na plataforma
              </p>
            </div>
            <div className="rounded-lg border border-[var(--loop-cta)] bg-[var(--loop-cta-muted)] p-3">
              <p className="text-xs text-[var(--loop-cta)]">
                Mensagens WhatsApp (custo Meta)
              </p>
              <p className="mt-1 text-xl font-bold text-[var(--loop-cta)]">
                {t.mensagensTotal.toLocaleString("pt-BR")}
              </p>
              <p className="mt-0.5 text-xs text-[var(--loop-cta)]">
                {t.mensagensQuinzena.toLocaleString("pt-BR")} nesta quinzena ·{" "}
                {Math.round(t.taxaPorMensagem * 100)}% viraram venda
              </p>
              <p className="text-xs text-[var(--loop-cta)]">
                custo Meta {eur(t.custoMetaEur)} (≈ {brl(t.custoMeta)})
              </p>
            </div>
            <div
              className="rounded-lg border p-3"
              style={{
                borderColor:
                  t.margem >= 0 ? "var(--loop-success)" : "var(--loop-error)",
              }}
            >
              <p className="text-xs text-[var(--loop-text-muted)]">
                Margem (comissão − custo Meta)
              </p>
              <p
                className="mt-1 text-xl font-bold"
                style={{
                  color:
                    t.margem >= 0 ? "var(--loop-success)" : "var(--loop-error)",
                }}
              >
                {brl(t.margem)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--loop-text-muted)]">
                comissão gerada (recebida + a receber) − custo Meta
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de cobranças */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Histórico de cobranças
          </h2>
        </CardHeader>
        <CardContent>
          {d.historico.length === 0 ? (
            <p className="text-sm text-[var(--loop-text-muted)]">
              Nenhuma cobrança fechada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                    <th className="pb-2 pr-4 font-medium">Período</th>
                    <th className="pb-2 pr-4 font-medium">Base</th>
                    <th className="pb-2 pr-4 font-medium">Comissão</th>
                    <th className="pb-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {d.historico.map((h) => {
                    const st = CHARGE_STATUS[h.status] ?? {
                      label: h.status,
                      variant: "default" as const,
                    };
                    return (
                      <tr
                        key={h.id}
                        className="border-b border-[var(--loop-border)]"
                      >
                        <td className="py-2 pr-4 text-[var(--loop-text)]">
                          {periodo(h)}
                        </td>
                        <td className="py-2 pr-4 text-[var(--loop-text-muted)]">
                          {brl(h.baseBrl)}
                        </td>
                        <td className="py-2 pr-4 font-medium text-[var(--loop-text)]">
                          {brl(h.comissaoBrl)}
                        </td>
                        <td className="py-2">
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
