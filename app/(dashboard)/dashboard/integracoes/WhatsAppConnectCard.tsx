"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";

interface Status {
  connected: boolean;
  /** false = os passos de WhatsApp dos fluxos não vão ser enviados. */
  canSend?: boolean;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayNumber: string | null;
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

/**
 * O número/WABA é fornecido e mantido pela LoopSale (nós pagamos a Meta). O
 * cliente não conecta nada — esta tela só mostra o status do número e os
 * templates disponíveis.
 */
export function WhatsAppConnectCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplError, setTplError] = useState("");

  const loadStatus = useCallback(async () => {
    const s = (await fetch("/api/whatsapp/status").then((r) => r.json())) as Status;
    setStatus(s);
    if (s.canSend || s.connected) {
      const t = await fetch("/api/whatsapp/templates").then((r) => r.json());
      setTemplates(t.templates ?? []);
      if (t.error) setTplError(t.error);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const ativo = !!(status?.canSend || status?.connected);

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <h2 className="font-semibold text-[var(--loop-text)]">WhatsApp</h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            O número usado nas suas recuperações é fornecido e mantido pela
            LoopSale — você não precisa configurar nada.
          </p>
        </div>
        <Badge variant={ativo ? "success" : "default"}>
          {ativo ? "Ativo" : "Em preparação"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ativo ? (
          <p className="rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-3 text-sm text-[var(--loop-text-muted)]">
            Estamos preparando o número de WhatsApp da sua conta. Assim que
            estiver pronto, as mensagens de recuperação passam a sair
            automaticamente — você não precisa fazer nada.
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-[var(--loop-border)] p-3">
              <p className="text-xs text-[var(--loop-text-muted)]">
                Número da sua conta
              </p>
              <p className="font-medium text-[var(--loop-text)]">
                {status?.displayNumber || status?.phoneNumberId || "—"}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[var(--loop-text)]">
                Templates
              </p>
              {tplError ? (
                <p className="text-sm text-[var(--loop-error)]">{tplError}</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-[var(--loop-text-muted)]">
                  Nenhum template criado ainda. Crie em Templates.
                </p>
              ) : (
                <div className="divide-y divide-[var(--loop-border)] rounded-lg border border-[var(--loop-border)]">
                  {templates.map((t) => (
                    <div
                      key={`${t.name}-${t.language}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
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
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
