"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";

interface PlanView {
  id: string;
  name: string;
  priceMonthly: number;
  priceNote: string | null;
  description: string;
  features: string[];
  highlighted: boolean;
  includesSupport: boolean;
  disponivel: boolean;
}

interface SupportInfo {
  name: string;
  description: string;
  priceMonthly: number;
  features: string[];
  scopeNote: string;
  disponivel: boolean;
  active: boolean;
  status: string;
}

interface Billing {
  planoAtual: string;
  status: string;
  currentPeriodEnd: string | null;
  configured: boolean;
  isAdmin: boolean;
  temAssinatura: boolean;
  plans: PlanView[];
  support: SupportInfo;
}

interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  created: number;
  pdf: string | null;
  hostedUrl: string | null;
}

interface CommissionRow {
  id: string;
  periodKey: string;
  baseBrl: number;
  comissaoBrl: number;
  status: string;
}

interface Commission {
  plano: string;
  cardOnFile: boolean;
  configured: boolean;
  isAdmin: boolean;
  periodoAtual: {
    periodKey: string;
    recuperadoBrl: number;
    recuperadoUsd: number;
    baseBrl: number;
    comissaoBrl: number;
    pagaKiwifyBrl: number;
  };
  historico: CommissionRow[];
}

const COMMISSION_STATUS: Record<string, string> = {
  paid: "Pago",
  invoiced: "Faturado",
  pending: "Pendente",
  no_card: "Sem cartão",
  failed: "Falhou",
  zero: "Sem cobrança",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  trialing: "Em teste",
  past_due: "Pagamento atrasado",
  canceled: "Cancelada",
  incomplete: "Incompleta",
  none: "Sem assinatura",
};

function formatMoney(v: number, currency = "BRL"): string {
  const usd = currency.toUpperCase() === "USD";
  return new Intl.NumberFormat(usd ? "en-US" : "pt-BR", {
    style: "currency",
    currency: usd ? "USD" : "BRL",
  }).format(v || 0);
}
function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PlanosPage() {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const [billing, setBilling] = useState<Billing | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [commission, setCommission] = useState<Commission | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, iRes, cRes] = await Promise.all([
        fetch("/api/billing"),
        fetch("/api/billing/invoices"),
        fetch("/api/billing/commission"),
      ]);
      setBilling(await bRes.json());
      const iData = await iRes.json();
      setInvoices(iData.invoices ?? []);
      setCommission(await cRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function contratar(planId: string) {
    setError("");
    setBusy(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Não foi possível iniciar o checkout.");
      }
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  async function gerenciar() {
    setError("");
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else setError(data.error ?? "Não foi possível abrir o portal.");
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

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

  async function ativarAtendimento() {
    setError("");
    setBusy("support");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addon: "support" }),
      });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else setError(data.error ?? "Não foi possível ativar o atendimento.");
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  const isAdmin = billing?.isAdmin;
  const currentPlan = billing?.plans.find((p) => p.id === billing.planoAtual);
  const planIncludesSupport = !!currentPlan?.includesSupport;
  // Atendimento ativo = add-on contratado OU incluído no plano atual.
  const supportActive = !!billing?.support.active || planIncludesSupport;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/configuracoes"
          className="mb-2 inline-block text-sm text-[var(--loop-primary)] hover:underline"
        >
          ← Configurações
        </Link>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">
          Planos e assinatura
        </h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Escolha o plano, gerencie o pagamento e veja suas faturas.
        </p>
      </div>

      {statusParam === "sucesso" && (
        <Card>
          <CardContent className="py-3 text-sm text-[var(--loop-success)]">
            Assinatura confirmada! Pode levar alguns segundos para atualizar.
          </CardContent>
        </Card>
      )}
      {statusParam === "cancelado" && (
        <Card>
          <CardContent className="py-3 text-sm text-[var(--loop-text-muted)]">
            Checkout cancelado. Nenhuma cobrança foi feita.
          </CardContent>
        </Card>
      )}

      {loading || !billing ? (
        <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>
      ) : (
        <>
          {!billing.configured && (
            <Card>
              <CardContent className="py-3 text-sm text-[var(--loop-warning)]">
                O pagamento (Stripe) ainda não está configurado. Os planos abaixo
                já aparecem; a contratação fica ativa quando as chaves do Stripe
                forem definidas.
              </CardContent>
            </Card>
          )}

          {/* Assinatura atual */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <h2 className="font-semibold text-[var(--loop-text)]">
                  Sua assinatura
                </h2>
                <p className="text-sm text-[var(--loop-text-muted)]">
                  Plano{" "}
                  <strong className="text-[var(--loop-text)]">
                    {billing.plans.find((p) => p.id === billing.planoAtual)
                      ?.name ?? billing.planoAtual}
                  </strong>
                  {billing.currentPeriodEnd &&
                    ` · renova em ${new Date(
                      billing.currentPeriodEnd
                    ).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <Badge
                variant={
                  billing.status === "active" || billing.status === "trialing"
                    ? "success"
                    : billing.status === "past_due"
                      ? "error"
                      : "default"
                }
              >
                {STATUS_LABEL[billing.status] ?? billing.status}
              </Badge>
            </CardHeader>
            {billing.temAssinatura && isAdmin && (
              <CardContent>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy === "portal"}
                  onClick={gerenciar}
                >
                  {busy === "portal"
                    ? "Abrindo…"
                    : "Gerenciar assinatura e pagamento"}
                </Button>
              </CardContent>
            )}
          </Card>

          {error && <p className="text-sm text-[var(--loop-error)]">{error}</p>}

          {/* Comissão do Free (40%) */}
          {commission && commission.plano === "free" && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-[var(--loop-text)]">
                  Comissão do plano Free
                </h2>
                <p className="text-sm text-[var(--loop-text-muted)]">
                  40% sobre as vendas recuperadas, cobrado mensalmente no cartão.
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
                    {commission.cardOnFile && (
                      <Badge variant="success">Ativo</Badge>
                    )}
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

                {/* Apuração do mês */}
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-xs text-[var(--loop-text-muted)]">
                      Comissão a cobrar (mês, parcial)
                    </p>
                    <p className="text-2xl font-bold text-[var(--loop-text)]">
                      {formatMoney(commission.periodoAtual.comissaoBrl)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--loop-text-muted)]">
                      Base cobrável (sem afiliado)
                    </p>
                    <p className="text-2xl font-bold text-[var(--loop-text)]">
                      {formatMoney(commission.periodoAtual.baseBrl)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--loop-text-muted)]">
                      Comissão já paga na Kiwify (afiliado)
                    </p>
                    <p className="text-2xl font-bold text-[var(--loop-text-muted)]">
                      {formatMoney(commission.periodoAtual.pagaKiwifyBrl)}
                    </p>
                  </div>
                </div>

                <a
                  href="/api/billing/commission/export"
                  className="inline-block text-sm text-[var(--loop-primary)] hover:underline"
                >
                  ↓ Baixar extrato (CSV)
                </a>

                {/* Histórico */}
                {commission.historico.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                          <th className="pb-2 pr-4 font-medium">Competência</th>
                          <th className="pb-2 pr-4 font-medium">Base</th>
                          <th className="pb-2 pr-4 font-medium">Comissão</th>
                          <th className="pb-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commission.historico.map((h) => (
                          <tr
                            key={h.id}
                            className="border-b border-[var(--loop-border)]"
                          >
                            <td className="py-2 pr-4 text-[var(--loop-text)]">
                              {h.periodKey}
                            </td>
                            <td className="py-2 pr-4 text-[var(--loop-text)]">
                              {formatMoney(h.baseBrl)}
                            </td>
                            <td className="py-2 pr-4 text-[var(--loop-text)]">
                              {formatMoney(h.comissaoBrl)}
                            </td>
                            <td className="py-2">
                              <Badge
                                variant={
                                  h.status === "paid"
                                    ? "success"
                                    : h.status === "failed"
                                      ? "error"
                                      : "default"
                                }
                              >
                                {COMMISSION_STATUS[h.status] ?? h.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Planos */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {billing.plans.map((p) => {
              const atual = p.id === billing.planoAtual;
              return (
                <Card
                  key={p.id}
                  className={
                    p.highlighted
                      ? "border-2 border-[var(--loop-primary)]"
                      : undefined
                  }
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[var(--loop-text)]">
                        {p.name}
                      </h3>
                      {atual && <Badge variant="success">Atual</Badge>}
                      {!atual && p.highlighted && (
                        <Badge variant="primary">Recomendado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-[var(--loop-text-muted)]">
                      {p.description}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-[var(--loop-text)]">
                      {p.priceMonthly === 0
                        ? "Grátis"
                        : formatMoney(p.priceMonthly)}
                      {p.priceMonthly > 0 && (
                        <span className="text-sm font-normal text-[var(--loop-text-muted)]">
                          /mês
                        </span>
                      )}
                    </p>
                    {p.priceNote && (
                      <p className="text-xs font-medium text-[var(--loop-cta)]">
                        {p.priceNote}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-1.5 text-sm text-[var(--loop-text)]">
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-2">
                          <span className="text-[var(--loop-success)]">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    {p.id !== "free" && !atual && (
                      <Button
                        variant={p.highlighted ? "cta" : "secondary"}
                        size="sm"
                        className="w-full justify-center"
                        disabled={!isAdmin || busy === p.id}
                        onClick={() => contratar(p.id)}
                      >
                        {busy === p.id ? "Redirecionando…" : "Contratar"}
                      </Button>
                    )}
                    {atual && (
                      <p className="text-center text-sm text-[var(--loop-text-muted)]">
                        Plano atual
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!isAdmin && (
            <p className="text-xs text-[var(--loop-text-muted)]">
              Apenas administradores podem contratar ou alterar o plano.
            </p>
          )}

          {/* Atendimento */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Atendimento
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Quem responde os clientes que reagem no WhatsApp.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Você atende */}
                <div
                  className={`rounded-lg border p-4 ${
                    supportActive
                      ? "border-[var(--loop-border)]"
                      : "border-2 border-[var(--loop-primary)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[var(--loop-text)]">
                      Você atende
                    </p>
                    {!supportActive && (
                      <Badge variant="success">Ativo</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--loop-text-muted)]">
                    Incluído em todos os planos. As respostas vão para o seu
                    WhatsApp/time.
                  </p>
                  <p className="mt-3 text-lg font-bold text-[var(--loop-text)]">
                    Grátis
                  </p>
                </div>

                {/* LoopSale atende */}
                <div
                  className={`rounded-lg border p-4 ${
                    supportActive
                      ? "border-2 border-[var(--loop-primary)]"
                      : "border-[var(--loop-border)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[var(--loop-text)]">
                      {billing.support.name}
                    </p>
                    {supportActive && (
                      <Badge variant="success">Ativo</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--loop-text-muted)]">
                    {billing.support.description}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--loop-text)]">
                    {billing.support.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-[var(--loop-success)]">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {billing.support.scopeNote && (
                    <p className="mt-2 rounded-md bg-[var(--loop-bg-alt)] p-2 text-xs text-[var(--loop-text-muted)]">
                      {billing.support.scopeNote}
                    </p>
                  )}
                  {planIncludesSupport ? (
                    <p className="mt-3 text-sm font-medium text-[var(--loop-success)]">
                      Incluído no seu plano {currentPlan?.name}.
                    </p>
                  ) : (
                    <>
                      <p className="mt-3 text-lg font-bold text-[var(--loop-text)]">
                        {formatMoney(billing.support.priceMonthly)}
                        <span className="text-sm font-normal text-[var(--loop-text-muted)]">
                          /mês
                        </span>
                      </p>
                      {billing.support.active ? (
                        <p className="mt-2 text-sm text-[var(--loop-text-muted)]">
                          Gerencie ou cancele em “Gerenciar assinatura”.
                        </p>
                      ) : (
                        <Button
                          variant="cta"
                          size="sm"
                          className="mt-3 w-full justify-center"
                          disabled={!isAdmin || busy === "support"}
                          onClick={ativarAtendimento}
                        >
                          {busy === "support"
                            ? "Redirecionando…"
                            : "Ativar atendimento"}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Faturas */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-[var(--loop-text)]">Faturas</h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Histórico de cobranças e recibos.
              </p>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="py-4 text-sm text-[var(--loop-text-muted)]">
                  Nenhuma fatura ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                        <th className="pb-2 pr-4 font-medium">Data</th>
                        <th className="pb-2 pr-4 font-medium">Número</th>
                        <th className="pb-2 pr-4 font-medium">Valor</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 font-medium">Recibo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-b border-[var(--loop-border)]"
                        >
                          <td className="py-3 pr-4 text-[var(--loop-text)]">
                            {formatDate(inv.created)}
                          </td>
                          <td className="py-3 pr-4 text-[var(--loop-text-muted)]">
                            {inv.number ?? "—"}
                          </td>
                          <td className="py-3 pr-4 text-[var(--loop-text)]">
                            {formatMoney(inv.amountPaid, inv.currency)}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant={
                                inv.status === "paid" ? "success" : "default"
                              }
                            >
                              {inv.status === "paid" ? "Pago" : inv.status}
                            </Badge>
                          </td>
                          <td className="py-3">
                            {inv.pdf || inv.hostedUrl ? (
                              <a
                                href={(inv.pdf ?? inv.hostedUrl) as string}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--loop-primary)] hover:underline"
                              >
                                Ver
                              </a>
                            ) : (
                              "—"
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
