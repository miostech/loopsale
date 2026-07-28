"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";

interface Status {
  configured: boolean;
  wabaId: string | null;
  wabaName?: string | null;
  mainNumber?: string | null;
  error?: string | null;
}
interface Numero {
  id: string;
  displayPhoneNumber: string;
  verifiedName?: string;
}
interface Template {
  name: string;
  status: string;
  language: string;
  category: string;
}

const TEMPLATE_BADGE: Record<string, "success" | "warning" | "error" | "default"> = {
  APPROVED: "success",
  PENDING: "warning",
  IN_APPEAL: "warning",
  REJECTED: "error",
  DISABLED: "error",
  PAUSED: "warning",
};

export function MetaReviewClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [denied, setDenied] = useState(false);

  const [numeros, setNumeros] = useState<Numero[] | null>(null);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [createMsg, setCreateMsg] = useState<{ ok?: string; err?: string }>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/admin/meta/status");
    if (res.status === 403) {
      setDenied(true);
      return;
    }
    setStatus(await res.json());
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function listarNumeros() {
    setErr("");
    setBusy("numeros");
    try {
      const res = await fetch("/api/admin/meta/numbers");
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Erro ao listar números.");
      else setNumeros(data.numbers ?? []);
    } finally {
      setBusy(null);
    }
  }

  async function listarTemplates() {
    setErr("");
    setBusy("templates");
    try {
      const res = await fetch("/api/admin/meta/templates");
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Erro ao listar templates.");
      else setTemplates(data.templates ?? []);
    } finally {
      setBusy(null);
    }
  }

  async function criarTemplate() {
    setCreateMsg({});
    setBusy("create");
    try {
      const res = await fetch("/api/admin/meta/test-template", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) setCreateMsg({ err: data.error ?? "Erro ao criar template." });
      else {
        setCreateMsg({
          ok: `Template "${data.name}" criado (status: ${data.status ?? "PENDING"}).`,
        });
        listarTemplates();
      }
    } finally {
      setBusy(null);
    }
  }

  if (denied) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">Meta Review</h1>
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
          WhatsApp — Meta Review
        </h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Validação da integração com a Cloud API (WABA central da LoopSale).
        </p>
      </div>

      {/* Conta conectada */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <h2 className="font-semibold text-[var(--loop-text)]">
            Conta conectada
          </h2>
          <Badge variant={status?.configured ? "success" : "default"}>
            {status?.configured ? "Conectada" : "Não configurada"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {!status ? (
            <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>
          ) : !status.configured ? (
            <p className="text-sm text-[var(--loop-error)]">
              Configure WHATSAPP_WABA_ID e WHATSAPP_ACCESS_TOKEN no ambiente.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--loop-border)] p-3">
                <p className="text-xs text-[var(--loop-text-muted)]">Conta</p>
                <p className="font-medium text-[var(--loop-text)]">
                  {status.wabaName || "WhatsApp Business"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--loop-border)] p-3">
                <p className="text-xs text-[var(--loop-text-muted)]">WABA ID</p>
                <p className="font-medium text-[var(--loop-text)]">
                  {status.wabaId}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--loop-border)] p-3">
                <p className="text-xs text-[var(--loop-text-muted)]">Número</p>
                <p className="font-medium text-[var(--loop-text)]">
                  {status.mainNumber || "—"}
                </p>
              </div>
            </div>
          )}
          {status?.error && (
            <p className="text-sm text-[var(--loop-error)]">{status.error}</p>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">Ações</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy === "numeros" || !status?.configured}
              onClick={listarNumeros}
            >
              {busy === "numeros" ? "Listando…" : "Listar números"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy === "templates" || !status?.configured}
              onClick={listarTemplates}
            >
              {busy === "templates" ? "Listando…" : "Listar templates"}
            </Button>
            <Button
              variant="cta"
              size="sm"
              disabled={busy === "create" || !status?.configured}
              onClick={criarTemplate}
            >
              {busy === "create" ? "Criando…" : "Criar template de teste"}
            </Button>
          </div>
          {err && <p className="text-sm text-[var(--loop-error)]">{err}</p>}
          {createMsg.ok && (
            <p className="text-sm text-[var(--loop-success)]">{createMsg.ok}</p>
          )}
          {createMsg.err && (
            <p className="text-sm text-[var(--loop-error)]">{createMsg.err}</p>
          )}
        </CardContent>
      </Card>

      {/* Números */}
      {numeros && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[var(--loop-text)]">
              Números ({numeros.length})
            </h2>
          </CardHeader>
          <CardContent>
            {numeros.length === 0 ? (
              <p className="text-sm text-[var(--loop-text-muted)]">
                Nenhum número na WABA.
              </p>
            ) : (
              <div className="divide-y divide-[var(--loop-border)]">
                {numeros.map((n) => (
                  <div key={n.id} className="py-2 text-sm">
                    <span className="font-medium text-[var(--loop-text)]">
                      {n.displayPhoneNumber}
                    </span>
                    {n.verifiedName && (
                      <span className="ml-2 text-[var(--loop-text-muted)]">
                        {n.verifiedName}
                      </span>
                    )}
                    <span className="ml-2 text-xs text-[var(--loop-text-muted)]">
                      id {n.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Templates */}
      {templates && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[var(--loop-text)]">
              Templates ({templates.length})
            </h2>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-sm text-[var(--loop-text-muted)]">
                Nenhum template criado ainda.
              </p>
            ) : (
              <div className="divide-y divide-[var(--loop-border)]">
                {templates.map((t) => (
                  <div
                    key={`${t.name}-${t.language}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div>
                      <span className="text-[var(--loop-text)]">{t.name}</span>
                      <span className="ml-2 text-xs text-[var(--loop-text-muted)]">
                        {t.language} · {t.category}
                      </span>
                    </div>
                    <Badge variant={TEMPLATE_BADGE[t.status] ?? "default"}>
                      {t.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
