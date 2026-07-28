"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent } from "@/components/ui";

interface IntegrationView {
  platform: string;
  active: boolean;
  config: Record<string, unknown>;
  webhookUrl: string | null;
}
interface Empresa {
  id: string;
  name: string;
  platform: string | null;
  createdAt: string;
  platformConnected: boolean;
  loopConnected: boolean;
  readyToApprove: boolean;
  integrations: IntegrationView[];
}

const PLATFORM_LABEL: Record<string, string> = {
  kiwify: "Kiwify",
  hotmart: "Hotmart",
  n8n: "Loop API",
};

function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function KeyRow({ k, v }: { k: string; v: unknown }) {
  const val = v == null || v === "" ? "—" : String(v);
  return (
    <div className="flex gap-2 py-0.5">
      <span className="min-w-32 shrink-0 text-[var(--loop-text-muted)]">{k}</span>
      <code className="break-all text-[var(--loop-text)]">{val}</code>
    </div>
  );
}

export default function AtivacoesPage() {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/activations");
    if (res.status === 403) {
      setDenied(true);
      return;
    }
    const data = await res.json();
    setEmpresas(data.empresas ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function aprovar(id: string) {
    setBusy(id);
    try {
      await fetch("/api/admin/activations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "aprovar" }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (denied) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">Ativações</h1>
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
          Empresas aguardando ativação
        </h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Veja as chaves, conecte onde precisar e aprove para liberar o painel do
          cliente.
        </p>
      </div>

      {empresas === null ? (
        <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>
      ) : empresas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-[var(--loop-text-muted)]">
            Nenhuma empresa aguardando ativação. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {empresas.map((e) => {
            const open = openId === e.id;
            return (
              <Card key={e.id}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-[var(--loop-text)]">
                          {e.name}
                        </h2>
                        <Badge variant="default">
                          {e.platform ? PLATFORM_LABEL[e.platform] : "—"}
                        </Badge>
                        {e.readyToApprove ? (
                          <Badge variant="success">Pronta para aprovar</Badge>
                        ) : (
                          <Badge variant="default">Aguardando integrações</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--loop-text-muted)]">
                        Cadastro em {dataBR(e.createdAt)} ·{" "}
                        {e.platformConnected ? "✓" : "✗"}{" "}
                        {e.platform ? PLATFORM_LABEL[e.platform] : "plataforma"} ·{" "}
                        {e.loopConnected ? "✓" : "✗"} Loop API
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setOpenId(open ? null : e.id)}
                      >
                        {open ? "Ocultar chaves" : "Ver chaves"}
                      </Button>
                      <Button
                        variant="cta"
                        size="sm"
                        disabled={busy === e.id}
                        onClick={() => aprovar(e.id)}
                      >
                        {busy === e.id ? "Aprovando…" : "Aprovar"}
                      </Button>
                    </div>
                  </div>

                  {open && (
                    <div className="space-y-4 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-4 text-xs">
                      {e.integrations.length === 0 ? (
                        <p className="text-[var(--loop-text-muted)]">
                          Nenhuma integração conectada ainda.
                        </p>
                      ) : (
                        e.integrations.map((i) => (
                          <div key={i.platform} className="space-y-1">
                            <p className="font-semibold text-[var(--loop-text)]">
                              {PLATFORM_LABEL[i.platform] ?? i.platform}{" "}
                              {i.active ? "" : "(inativa)"}
                            </p>
                            {Object.entries(i.config).map(([k, v]) => (
                              <KeyRow key={k} k={k} v={v} />
                            ))}
                            {i.webhookUrl && (
                              <KeyRow k="webhookUrl" v={i.webhookUrl} />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
