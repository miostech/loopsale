"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";

interface CommissionRow {
  id: string;
  periodKey: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  baseBrl: number;
  comissaoBrl: number;
  status: string;
  updatedAt?: string | null;
}

interface Commission {
  plano: string;
  rate: number;
  cardOnFile: boolean;
  configured: boolean;
  isAdmin: boolean;
  proximaCobranca?: string | null;
  periodoAtual: {
    periodKey: string;
    recuperadoBrl: number;
    recuperadoUsd: number;
    baseBrl: number;
    comissaoBrl: number;
    pagaKiwifyBrl: number;
    retidaBrl: number;
  };
  historico: CommissionRow[];
}

// Situação do débito no cartão: Pago (ok) x Em aberto (falhou/pendente).
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

const PLANO_LABEL: Record<string, string> = {
  free: "Grátis",
  pro: "Pro",
  escala: "Escala",
  enterprise: "Enterprise",
};

function formatMoney(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v || 0);
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPeriodo(row: CommissionRow): string {
  if (row.periodStart && row.periodEnd) {
    const dm = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const start = new Date(row.periodStart);
    // periodEnd é exclusivo (início do dia seguinte) → mostra o último dia.
    const end = new Date(new Date(row.periodEnd).getTime() - 86400000);
    return `${dm(start)} – ${dm(end)}`;
  }
  return row.periodKey;
}

export default function ComissaoPage() {
  const [commission, setCommission] = useState<Commission | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/commission");
      setCommission(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function adicionarCartao() {
    setError("");
    setBusy("card");
    try {
      const res = await fetch("/api/billing/card", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else setError(data.error ?? "Não foi possível cadastrar o cartão.");
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  const isAdmin = commission?.isAdmin;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">Comissão</h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Comissão que você paga sobre as vendas recuperadas, a cada 15 dias no
          cartão.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>
      ) : !commission || commission.rate <= 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-[var(--loop-text-muted)]">
            Seu plano{" "}
            <strong>
              {PLANO_LABEL[commission?.plano ?? ""] ?? commission?.plano}
            </strong>{" "}
            não tem comissão sobre vendas recuperadas — o atendimento e os limites
            são cobrados na assinatura do plano.
          </CardContent>
        </Card>
      ) : (
        <>
          {error && <p className="text-sm text-[var(--loop-error)]">{error}</p>}

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Plano {PLANO_LABEL[commission.plano] ?? commission.plano} ·{" "}
                {Math.round(commission.rate * 100)}% sobre recuperadas
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Você paga a cada 15 dias (quinzenal) no cartão cadastrado.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cartão */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--loop-border)] p-3">
                <div>
                  <p className="text-sm font-medium text-[var(--loop-text)]">
                    Cartão de cobrança
                  </p>
                  <p className="text-xs text-[var(--loop-text-muted)]">
                    {commission.cardOnFile
                      ? "Cartão cadastrado."
                      : "Cadastre um cartão para a cobrança da comissão."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {commission.cardOnFile && <Badge variant="success">Ativo</Badge>}
                  {isAdmin && (
                    <Button
                      variant={commission.cardOnFile ? "secondary" : "cta"}
                      size="sm"
                      disabled={busy === "card"}
                      onClick={adicionarCartao}
                    >
                      {busy === "card"
                        ? "Redirecionando…"
                        : commission.cardOnFile
                          ? "Trocar cartão"
                          : "Adicionar cartão"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Como a comissão é calculada */}
              <p className="rounded-lg bg-[var(--loop-bg-alt)] p-3 text-xs text-[var(--loop-text-muted)]">
                A comissão de {Math.round(commission.rate * 100)}% incide sobre o
                que recuperamos pelo <strong>seu</strong> checkout. Vendas
                recuperadas que saíram pelo afiliado (Kiwify/Hotmart) já tiveram a
                comissão paga na plataforma, então <strong>não</strong> entram
                neste pagamento.
              </p>

              {/* Apuração da quinzena */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-[var(--loop-border)] p-3">
                  <p className="text-xs text-[var(--loop-text-muted)]">
                    Recuperado no período (base da comissão)
                  </p>
                  <p className="text-2xl font-bold text-[var(--loop-text)]">
                    {formatMoney(commission.periodoAtual.baseBrl)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--loop-text-muted)]">
                    × {Math.round(commission.rate * 100)}%
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--loop-primary)] bg-[var(--loop-primary-muted)] p-3">
                  <p className="text-xs text-[var(--loop-primary)]">
                    Comissão a pagar
                  </p>
                  <p className="text-2xl font-bold text-[var(--loop-primary)]">
                    {formatMoney(commission.periodoAtual.comissaoBrl)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--loop-primary)]">
                    Próxima cobrança: {formatDate(commission.proximaCobranca)}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--loop-border)] p-3">
                  <p className="text-xs text-[var(--loop-text-muted)]">
                    Comissão paga via Kiwify/Hotmart
                  </p>
                  <p className="text-2xl font-bold text-[var(--loop-text-muted)]">
                    {formatMoney(commission.periodoAtual.pagaKiwifyBrl)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--loop-text-muted)]">
                    não entra neste pagamento
                  </p>
                </div>
                {commission.periodoAtual.retidaBrl > 0 && (
                  <div className="rounded-lg border border-[var(--loop-warning)] p-3">
                    <p className="text-xs text-[var(--loop-warning)]">
                      Comissão retida (reembolso do vendedor)
                    </p>
                    <p className="text-2xl font-bold text-[var(--loop-warning)]">
                      {formatMoney(commission.periodoAtual.retidaBrl)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--loop-warning)]">
                      segurada para revisão manual
                    </p>
                  </div>
                )}
              </div>

              <a
                href="/api/billing/commission/export"
                className="inline-block text-sm text-[var(--loop-primary)] hover:underline"
              >
                ↓ Baixar extrato (CSV)
              </a>

            </CardContent>
          </Card>

          {/* Histórico de cobranças no cartão */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Histórico de cobranças
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Comissões debitadas do cartão a cada quinzena — pago ou em aberto.
              </p>
            </CardHeader>
            <CardContent>
              {commission.historico.length === 0 ? (
                <p className="text-sm text-[var(--loop-text-muted)]">
                  Nenhuma cobrança ainda. As comissões debitadas aparecem aqui a
                  cada 15 dias.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                        <th className="pb-2 pr-4 font-medium">Período</th>
                        <th className="pb-2 pr-4 font-medium">Comissão</th>
                        <th className="pb-2 font-medium">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commission.historico.map((h) => {
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
                              {formatPeriodo(h)}
                            </td>
                            <td className="py-2 pr-4 font-medium text-[var(--loop-text)]">
                              {formatMoney(h.comissaoBrl)}
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
        </>
      )}
    </div>
  );
}
