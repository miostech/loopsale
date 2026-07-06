"use client";

import { useState } from "react";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";

export function N8nCard() {
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function connect(regenerate = false) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "n8n", regenerate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível conectar o n8n.");
        return;
      }
      setWebhookUrl(data.webhookUrl ?? null);
    } catch {
      setError("Erro de rede ao conectar o n8n.");
    } finally {
      setLoading(false);
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
      <CardHeader>
        <h2 className="font-semibold text-[var(--loop-text)]">n8n</h2>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Envie eventos do seu fluxo do n8n (carrinhos, vendas etc.) para o
          LoopSale rastrear nas métricas.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!webhookUrl ? (
          <Button
            variant="cta"
            size="sm"
            disabled={loading}
            onClick={() => connect(false)}
          >
            {loading ? "Conectando…" : "Conectar n8n"}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[var(--loop-text-muted)]">
              Cole esta URL num nó <strong>HTTP Request</strong> (método POST) no
              seu fluxo do n8n:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-[var(--loop-bg-alt)] border border-[var(--loop-border)] px-3 py-2 text-xs text-[var(--loop-text)]">
                {webhookUrl}
              </code>
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => connect(true)}
            >
              {loading ? "Gerando…" : "Gerar novo token"}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-[var(--loop-error)]">{error}</p>}

        <details className="text-xs text-[var(--loop-text-muted)]">
          <summary className="cursor-pointer select-none">
            Formato do payload esperado
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--loop-bg-alt)] border border-[var(--loop-border)] p-3">
{`{
  "event": "checkout_iniciado",   // ou checkout_abandonado, pagamento_aprovado...
  "checkoutId": "abc123",
  "email": "cliente@exemplo.com",
  "phone": "5511999999999",
  "productName": "Curso X",
  "amount": "197.00"
}`}
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}
