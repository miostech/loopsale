"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";

interface Summary {
  compras: number;
  abandonos: number;
  recuperados: number;
  recusados: number;
  mensagens: number;
  totalGastoBrl: number;
  totalGastoUsd: number;
  primeiroContato: string | null;
  ultimoContato: string | null;
}

interface Produto {
  produto: string;
  iniciados: number;
  abandonos: number;
  compras: number;
  recuperados: number;
  valorBrl: number;
  valorUsd: number;
  ultimaData: string | null;
}

interface TimelineItem {
  type: string;
  date: string;
  data: {
    product?: string | null;
    amount?: string | null;
    currency?: string | null;
    platform?: string | null;
    affiliate?: string | null;
    recoveryType?: string | null;
    recoveredAt?: string | null;
    refundStatus?: string | null;
    refundReason?: string | null;
    refundRequester?: string | null;
  };
}

interface ClienteDetail {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  status: string;
  source: string;
  createdAt?: string;
  summary: Summary;
  produtos: Produto[];
  timeline: TimelineItem[];
}

const STATUS_LABEL: Record<string, string> = {
  lead: "Lead",
  hot: "Quente",
  purchased: "Comprou",
  paid: "Pago",
  refunded: "Reembolso",
  retained: "Reembolso (vendedor)",
};
const STATUS_VARIANT: Record<
  string,
  "default" | "cta" | "success" | "error" | "warning"
> = {
  purchased: "success",
  hot: "cta",
  lead: "default",
  // Pago (venda direta, fora do funil) fica cinza — já foi finalizado.
  paid: "default",
  refunded: "error",
  // Reembolso pedido pelo vendedor: sinalizado (comissão retida p/ revisão).
  retained: "warning",
};
const SOURCE_LABEL: Record<string, string> = {
  checkout: "Checkout",
  approved: "Aprovado",
  whatsapp: "WhatsApp",
  manual: "Manual",
};

const EVENT_LABEL: Record<string, string> = {
  checkout_iniciado: "Checkout iniciado",
  checkout_abandonado: "Carrinho abandonado",
  abandono: "Carrinho abandonado",
  recuperado: "Venda recuperada",
  pagamento_aprovado: "Pagamento aprovado",
  pagamento_recusado: "Pagamento recusado",
  whatsapp_enviado: "WhatsApp enviado",
  whatsapp_status: "Status do WhatsApp",
  reembolso: "Reembolso",
  pedido_cancelado: "Pedido cancelado",
};
const EVENT_COLOR: Record<string, string> = {
  recuperado: "var(--loop-success)",
  pagamento_aprovado: "var(--loop-success)",
  pagamento_recusado: "var(--loop-error)",
  checkout_abandonado: "var(--loop-warning)",
  abandono: "var(--loop-warning)",
  whatsapp_enviado: "var(--loop-cta)",
  checkout_iniciado: "var(--loop-primary)",
  reembolso: "var(--loop-error)",
};

const REFUND_STATUS_LABEL: Record<string, string> = {
  pending: "pendente",
  refunded: "reembolsado",
  cancelled: "cancelado",
};

/** Normaliza o solicitante do reembolso vindo do payload em buyer/seller. */
function refundRequesterKind(raw?: string | null): "buyer" | "seller" | null {
  const s = (raw ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("sell") || s.includes("vend") || s.includes("loj")) return "seller";
  if (s.includes("buy") || s.includes("compr") || s.includes("client")) return "buyer";
  return null;
}

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
function formatMoney(amount?: string | null, currency?: string | null): string {
  const n = parseFloat(amount ?? "0") || 0;
  if (!amount) return "—";
  return String(currency ?? "BRL").toUpperCase() === "USD"
    ? formatUSD(n)
    : formatBRL(n);
}
function formatDate(value?: string | null): string {
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

export default function ClienteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [c, setC] = useState<ClienteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/leads/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setC)
      .catch(() => setC(null))
      .finally(() => setLoading(false));
  }, [id]);

  const back = (
    <Link
      href="/dashboard/clientes"
      className="mb-4 inline-block text-[var(--loop-primary)] hover:underline"
    >
      ← Voltar aos clientes
    </Link>
  );

  if (loading) {
    return (
      <div>
        {back}
        <p className="text-[var(--loop-text-muted)]">Carregando…</p>
      </div>
    );
  }
  if (!c) {
    return (
      <div>
        {back}
        <p className="text-[var(--loop-text-muted)]">Cliente não encontrado.</p>
      </div>
    );
  }

  const s = c.summary;
  const cards = [
    { label: "Compras", value: s.compras, accent: "var(--loop-success)" },
    { label: "Abandonos", value: s.abandonos, accent: "var(--loop-warning)" },
    { label: "Recuperados", value: s.recuperados, accent: "var(--loop-success)" },
    { label: "Mensagens", value: s.mensagens, accent: "var(--loop-cta)" },
  ];

  return (
    <div className="space-y-6">
      {back}

      {/* Cabeçalho */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[var(--loop-text)]">
                {c.name && c.name !== "sem_nome"
                  ? c.name
                  : c.email ?? c.phone ?? "Cliente"}
              </h1>
              <p className="mt-1 text-sm text-[var(--loop-text-muted)]">
                {c.email ?? "—"}
                {c.phone ? ` • ${c.phone}` : ""}
              </p>
              <p className="mt-1 text-xs text-[var(--loop-text-muted)]">
                Origem: {SOURCE_LABEL[c.source] ?? c.source} · Cliente desde{" "}
                {formatDate(c.createdAt)} · Últ. contato{" "}
                {formatDate(s.ultimoContato)}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[c.status] ?? "default"}>
              {STATUS_LABEL[c.status] ?? c.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-[var(--loop-text-muted)]">
                Total gasto (R$)
              </p>
              <p className="text-xl font-bold text-[var(--loop-success)]">
                {formatBRL(s.totalGastoBrl)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--loop-text-muted)]">
                Total gasto (US$)
              </p>
              <p className="text-xl font-bold text-[var(--loop-success)]">
                {formatUSD(s.totalGastoUsd)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((k) => (
          <Card key={k.label}>
            <CardContent className="py-4">
              <p className="text-sm text-[var(--loop-text-muted)]">{k.label}</p>
              <p
                className="mt-1 text-2xl font-bold"
                style={{ color: k.accent }}
              >
                {k.value.toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Produtos */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Produtos do cliente
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            O que ele iniciou, abandonou, recuperou e comprou por produto
          </p>
        </CardHeader>
        <CardContent>
          {c.produtos.length === 0 ? (
            <p className="py-4 text-sm text-[var(--loop-text-muted)]">
              Nenhum produto associado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                    <th className="pb-2 pr-4 font-medium">Produto</th>
                    <th className="pb-2 pr-4 font-medium">Iniciados</th>
                    <th className="pb-2 pr-4 font-medium">Abandonos</th>
                    <th className="pb-2 pr-4 font-medium">Recuperados</th>
                    <th className="pb-2 pr-4 font-medium">Compras</th>
                    <th className="pb-2 font-medium">Valor comprado</th>
                  </tr>
                </thead>
                <tbody>
                  {c.produtos.map((p) => (
                    <tr
                      key={p.produto}
                      className="border-b border-[var(--loop-border)]"
                    >
                      <td className="py-3 pr-4 font-medium text-[var(--loop-text)]">
                        {p.produto}
                      </td>
                      <td className="py-3 pr-4 text-[var(--loop-text)]">
                        {p.iniciados}
                      </td>
                      <td className="py-3 pr-4 text-[var(--loop-text)]">
                        {p.abandonos}
                      </td>
                      <td className="py-3 pr-4 text-[var(--loop-text)]">
                        {p.recuperados}
                      </td>
                      <td className="py-3 pr-4 text-[var(--loop-text)]">
                        {p.compras}
                      </td>
                      <td className="py-3 text-[var(--loop-text)]">
                        {p.valorBrl > 0 && formatBRL(p.valorBrl)}
                        {p.valorBrl > 0 && p.valorUsd > 0 && " · "}
                        {p.valorUsd > 0 && formatUSD(p.valorUsd)}
                        {p.valorBrl === 0 && p.valorUsd === 0 && "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Histórico de interações
          </h2>
        </CardHeader>
        <CardContent>
          {c.timeline.length === 0 ? (
            <p className="text-[var(--loop-text-muted)]">
              Nenhum evento registrado.
            </p>
          ) : (
            <ul className="space-y-3">
              {c.timeline.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background:
                        EVENT_COLOR[item.type] ?? "var(--loop-text-muted)",
                    }}
                  />
                  <div className="min-w-0 flex-1 border-b border-[var(--loop-border)] pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-[var(--loop-text)]">
                        {EVENT_LABEL[item.type] ??
                          item.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-[var(--loop-text-muted)]">
                        {formatDate(item.date)}
                      </p>
                    </div>
                    <div className="mt-0.5 text-sm text-[var(--loop-text-muted)]">
                      {item.data.product && <span>{item.data.product}</span>}
                      {item.data.amount && (
                        <span>
                          {" • "}
                          {formatMoney(item.data.amount, item.data.currency)}
                        </span>
                      )}
                      {item.data.affiliate && (
                        <span>{` • afiliado: ${item.data.affiliate}`}</span>
                      )}
                      {item.data.refundStatus && (
                        <span>
                          {` • `}
                          {REFUND_STATUS_LABEL[
                            String(item.data.refundStatus).toLowerCase()
                          ] ?? item.data.refundStatus}
                        </span>
                      )}
                      {item.data.refundRequester &&
                        (refundRequesterKind(item.data.refundRequester) ===
                        "seller" ? (
                          <span className="mt-0.5 block font-medium text-[var(--loop-error)]">
                            {`⚠ pedido pelo vendedor — verificar possível fuga de comissão`}
                          </span>
                        ) : (
                          <span>{` • pedido pelo comprador`}</span>
                        ))}
                      {item.data.refundReason && (
                        <span className="mt-0.5 block italic">
                          {`"${item.data.refundReason}"`}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
