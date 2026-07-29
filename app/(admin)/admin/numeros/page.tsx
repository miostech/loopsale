"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, Input } from "@/components/ui";

interface Pedido {
  id: string;
  accountId: string;
  empresa: string;
  contato: string;
  status: string;
  deliveredNumber: string | null;
  addonAtivo: boolean;
  whatsappConectado: boolean;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  provisioning: "Provisionar linha",
  delivered: "Entregue",
  canceled: "Cancelado",
};
const STATUS_BADGE: Record<string, "success" | "warning" | "error" | "default"> = {
  pending: "warning",
  provisioning: "warning",
  delivered: "success",
  canceled: "default",
};

function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function NumerosPage() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [numero, setNumero] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/number-requests");
    if (res.status === 403) {
      setDenied(true);
      return;
    }
    const data = await res.json();
    setPedidos(data.pedidos ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function acao(id: string, action: "entregar" | "cancelar") {
    setErro("");
    setBusy(id);
    try {
      const res = await fetch("/api/admin/number-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, numero: numero[id] ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível atualizar o pedido.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (denied) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">Números</h1>
        <p className="mt-2 text-sm text-[var(--loop-error)]">
          Acesso restrito ao time da LoopSale.
        </p>
      </div>
    );
  }

  const abertos = (pedidos ?? []).filter((p) =>
    ["pending", "provisioning"].includes(p.status)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">
          Pedidos de número gerenciado
        </h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Clientes que pagaram a ativação e estão esperando a linha. Provisione o
          número e registre aqui para fechar o pedido.
        </p>
      </div>

      {erro && <p className="text-sm text-[var(--loop-error)]">{erro}</p>}

      {pedidos === null ? (
        <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>
      ) : abertos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-[var(--loop-text-muted)]">
            Nenhum pedido em aberto. 🎉
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {(pedidos ?? []).map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-[var(--loop-text)]">
                      {p.empresa}
                    </h2>
                    <Badge variant={STATUS_BADGE[p.status] ?? "default"}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                    {!p.addonAtivo && p.status !== "canceled" && (
                      <Badge variant="error">Assinatura inativa</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--loop-text-muted)]">
                    Pedido em {dataBR(p.createdAt)} · {p.contato} ·{" "}
                    {p.whatsappConectado ? "✓" : "✗"} WhatsApp conectado
                    {p.deliveredNumber ? ` · ${p.deliveredNumber}` : ""}
                  </p>
                </div>
              </div>

              {["pending", "provisioning"].includes(p.status) && (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-56">
                    <Input
                      label="Número entregue"
                      placeholder="+55 11 90000-0000"
                      value={numero[p.id] ?? ""}
                      onChange={(e) =>
                        setNumero((n) => ({ ...n, [p.id]: e.target.value }))
                      }
                    />
                  </div>
                  <Button
                    variant="cta"
                    size="sm"
                    disabled={busy === p.id}
                    onClick={() => acao(p.id, "entregar")}
                  >
                    {busy === p.id ? "Salvando…" : "Marcar como entregue"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy === p.id}
                    onClick={() => acao(p.id, "cancelar")}
                  >
                    Cancelar pedido
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
