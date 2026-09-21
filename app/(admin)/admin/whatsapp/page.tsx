"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

interface Config {
  verifyToken: string;
  wabaId: string;
  webhookUrl: string;
  tokenSource: "banco" | "env" | "nenhum";
}

interface MetaTemplate {
  name: string;
  status: string;
  language: string;
  category: string;
}

const SRC_LABEL: Record<string, { label: string; variant: "success" | "warning" | "error" }> = {
  banco: { label: "Definido no painel", variant: "success" },
  env: { label: "Usando o do ambiente", variant: "warning" },
  nenhum: { label: "Sem token", variant: "error" },
};

function Campo({ label, value }: { label: string; value: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--loop-border)] p-3">
      <p className="text-xs text-[var(--loop-text-muted)]">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <code className="min-w-0 truncate text-sm text-[var(--loop-text)]">
          {value || "—"}
        </code>
        {value && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(value);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            }}
            className="shrink-0 text-xs text-[var(--loop-primary)] hover:underline"
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminWhatsAppPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [erro, setErro] = useState("");

  const [novoToken, setNovoToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const [templates, setTemplates] = useState<MetaTemplate[] | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/whatsapp");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setErro(data.error ?? "Não foi possível carregar.");
      else setCfg(data);
    } catch {
      setErro("Erro de rede.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function salvarToken() {
    setMsg({});
    if (!novoToken.trim()) {
      setMsg({ err: "Cole o token novo." });
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: novoToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ err: data.error ?? "Não foi possível salvar." });
      else {
        setMsg({ ok: "Token atualizado." });
        setNovoToken("");
        load();
      }
    } catch {
      setMsg({ err: "Erro de rede." });
    } finally {
      setSalvando(false);
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    setTemplates(null);
    try {
      const res = await fetch("/api/admin/meta/templates");
      const data = await res.json().catch(() => ({}));
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
      if (data.error) setErro(data.error);
    } catch {
      setErro("Erro ao sincronizar modelos.");
    } finally {
      setSincronizando(false);
    }
  }

  const src = cfg ? SRC_LABEL[cfg.tokenSource] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">
          WhatsApp (Meta) — configurações
        </h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          WABA central da LoopSale: token de verificação do webhook, chave da API
          e sincronização dos modelos.
        </p>
      </div>

      {erro && <p className="text-sm text-[var(--loop-error)]">{erro}</p>}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">Webhook</h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Use estes valores ao configurar o webhook na Meta.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Campo label="Token de verificação do webhook" value={cfg?.verifyToken ?? ""} />
          <Campo label="URL do webhook" value={cfg?.webhookUrl ?? ""} />
          <Campo label="WABA ID (central)" value={cfg?.wabaId ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <h2 className="font-semibold text-[var(--loop-text)]">
              Chave da API (token)
            </h2>
            <p className="text-sm text-[var(--loop-text-muted)]">
              Token de acesso da WABA central. Atualize aqui quando expirar — vale
              na hora, sem redeploy. Recomendado usar um token de System User (não
              expira).
            </p>
          </div>
          {src && <Badge variant={src.variant}>{src.label}</Badge>}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-[var(--loop-text-muted)]">
            Por segurança, o token atual não é exibido. Cole o novo token para
            substituir.
          </p>
          <Input
            label="Novo token da API"
            type="password"
            autoComplete="off"
            placeholder="EAAG..."
            value={novoToken}
            onChange={(e) => setNovoToken(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button variant="cta" size="sm" disabled={salvando} onClick={salvarToken}>
              {salvando ? "Salvando…" : "Atualizar chave de API"}
            </Button>
            {msg.ok && (
              <span className="text-sm text-[var(--loop-success)]">{msg.ok}</span>
            )}
            {msg.err && (
              <span className="text-sm text-[var(--loop-error)]">{msg.err}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <h2 className="font-semibold text-[var(--loop-text)]">Modelos</h2>
            <p className="text-sm text-[var(--loop-text-muted)]">
              Templates aprovados na WABA central, direto da Meta.
            </p>
          </div>
          <Button variant="secondary" size="sm" disabled={sincronizando} onClick={sincronizar}>
            {sincronizando ? "Sincronizando…" : "Sincronizar modelos"}
          </Button>
        </CardHeader>
        <CardContent>
          {templates === null ? (
            <p className="text-sm text-[var(--loop-text-muted)]">
              Clique em “Sincronizar modelos” para listar.
            </p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-[var(--loop-text-muted)]">
              Nenhum modelo encontrado (ou token inválido).
            </p>
          ) : (
            <div className="divide-y divide-[var(--loop-border)] rounded-lg border border-[var(--loop-border)]">
              {templates.map((t) => (
                <div
                  key={`${t.name}-${t.language}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="text-[var(--loop-text)]">
                    {t.name}
                    <span className="ml-2 text-xs text-[var(--loop-text-muted)]">
                      {t.language} · {t.category}
                    </span>
                  </span>
                  <span className="text-xs text-[var(--loop-text-muted)]">{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
