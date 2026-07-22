"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

export interface CredentialField {
  key: string;
  label: string;
  secret: boolean;
  placeholder?: string;
  hint?: string;
}

interface CredentialState {
  value: string;
  secret: boolean;
  set: boolean;
}

interface IntegrationData {
  platform: string;
  webhookUrl: string | null;
  credentials: Record<string, CredentialState>;
}

export function CredentialCard({
  platform,
  title,
  description,
  fields,
}: {
  platform: "kiwify" | "hotmart";
  title: string;
  description: string;
  fields: CredentialField[];
}) {
  const [saved, setSaved] = useState<Record<string, CredentialState>>({});
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const applyData = useCallback(
    (data: IntegrationData | undefined) => {
      setWebhookUrl(data?.webhookUrl ?? null);
      const creds = data?.credentials ?? {};
      setSaved(creds);
      // Campos não-secretos são pré-preenchidos; secretos começam vazios.
      const initial: Record<string, string> = {};
      for (const f of fields) {
        initial[f.key] = f.secret ? "" : creds[f.key]?.value ?? "";
      }
      setValues(initial);
    },
    [fields]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      const list = (await res.json().catch(() => [])) as IntegrationData[];
      applyData(
        Array.isArray(list)
          ? list.find((i) => i.platform === platform)
          : undefined
      );
    } catch {
      setError("Erro ao carregar a integração.");
    } finally {
      setLoading(false);
    }
  }, [platform, applyData]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setError("");
    setOkMsg("");
    setSaving(true);
    try {
      const credentials: Record<string, string> = {};
      for (const f of fields) {
        const v = (values[f.key] ?? "").trim();
        if (v) credentials[f.key] = v;
      }
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, credentials }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar.");
        return;
      }
      applyData(data as IntegrationData);
      setOkMsg("Credenciais salvas.");
      setTimeout(() => setOkMsg(""), 2500);
    } catch {
      setError("Erro de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function copyWebhook() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar. Copie manualmente.");
    }
  }

  const isConnected = fields.some((f) => saved[f.key]?.set);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <h2 className="font-semibold text-[var(--loop-text)]">{title}</h2>
          <p className="text-sm text-[var(--loop-text-muted)]">{description}</p>
        </div>
        <Badge variant={isConnected ? "success" : "default"}>
          {isConnected ? "Conectado" : "Não conectado"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-[var(--loop-text-muted)]">Carregando…</p>
        ) : (
          <>
            {fields.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                type={f.secret ? "password" : "text"}
                autoComplete="off"
                placeholder={
                  f.secret && saved[f.key]?.set
                    ? `${saved[f.key].value} (salvo — deixe em branco p/ manter)`
                    : f.placeholder ?? ""
                }
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
              />
            ))}

            <div className="flex items-center gap-3">
              <Button
                variant="cta"
                size="sm"
                disabled={saving}
                onClick={save}
              >
                {saving ? "Salvando…" : "Salvar credenciais"}
              </Button>
              {okMsg && (
                <span className="text-sm text-[var(--loop-success)]">
                  {okMsg}
                </span>
              )}
            </div>

            {error && (
              <p className="text-sm text-[var(--loop-error)]">{error}</p>
            )}

            {webhookUrl && (
              <div className="space-y-1 border-t border-[var(--loop-border)] pt-3">
                <p className="text-xs text-[var(--loop-text-muted)]">
                  URL de webhook para configurar no painel da {title}:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] px-3 py-2 text-xs text-[var(--loop-text)]">
                    {webhookUrl}
                  </code>
                  <Button variant="secondary" size="sm" onClick={copyWebhook}>
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
