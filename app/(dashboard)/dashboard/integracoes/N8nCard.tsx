"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";

interface IntegrationData {
  platform: string;
  webhookUrl: string | null;
}

export function N8nCard() {
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      const list = (await res.json().catch(() => [])) as IntegrationData[];
      const n8n = Array.isArray(list)
        ? list.find((i) => i.platform === "n8n")
        : undefined;
      setWebhookUrl(n8n?.webhookUrl ?? null);
    } catch {
      setError("Erro ao carregar a integração.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function connect(regenerate = false) {
    setError("");
    setWorking(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "n8n", regenerate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível conectar a Loop API.");
        return;
      }
      setWebhookUrl(data.webhookUrl ?? null);
    } catch {
      setError("Erro de rede ao conectar a Loop API.");
    } finally {
      setWorking(false);
    }
  }

  async function copy() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar. Copie manualmente.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <h2 className="font-semibold text-[var(--loop-text)]">Loop API</h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Envie os eventos do seu fluxo (carrinhos, vendas, WhatsApp) para o
            LoopSale medir a recuperação.
          </p>
        </div>
        <Badge variant={webhookUrl ? "success" : "default"}>
          {webhookUrl ? "Conectado" : "Não conectado"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>
        ) : !webhookUrl ? (
          <Button
            variant="cta"
            size="sm"
            disabled={working}
            onClick={() => connect(false)}
          >
            {working ? "Conectando…" : "Conectar Loop API"}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[var(--loop-text-muted)]">
              Use esta URL em <strong>todos</strong> os nós HTTP Request (POST) do
              seu fluxo — inclusive o de pagamento aprovado:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] px-3 py-2 text-xs text-[var(--loop-text)]">
                {webhookUrl}
              </code>
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={working}
              onClick={() => connect(true)}
            >
              {working ? "Gerando…" : "Gerar novo token"}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-[var(--loop-error)]">{error}</p>}

        <details className="text-xs text-[var(--loop-text-muted)]">
          <summary className="cursor-pointer select-none">
            Exemplo de payload
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-3">
{`{
  "event": "pagamento_aprovado",   // ou checkout_abandonado, pagamento_recusado…
  "email": "cliente@exemplo.com",  // usado p/ casar a recuperação
  "phone": "5511999999999",
  "productName": "Curso X",
  "amount": "197.00"
}`}
          </pre>
          <p className="mt-2">
            A recuperação é casada por <strong>email + produto</strong>, então o
            <code> checkoutId</code> pode ir vazio nos eventos de venda.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
