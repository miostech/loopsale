"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";

const FB_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID;
const GRAPH_VERSION = "v21.0";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

interface Status {
  connected: boolean;
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

export function WhatsAppConnectCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplError, setTplError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const sessionInfo = useRef<{ waba_id?: string; phone_number_id?: string }>({});

  const loadStatus = useCallback(async () => {
    const s = (await fetch("/api/whatsapp/status").then((r) => r.json())) as Status;
    setStatus(s);
    if (s.connected) {
      const t = await fetch("/api/whatsapp/templates").then((r) => r.json());
      setTemplates(t.templates ?? []);
      if (t.error) setTplError(t.error);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Carrega o SDK do Facebook uma vez.
  useEffect(() => {
    if (!FB_APP_ID) return;
    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: FB_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: GRAPH_VERSION,
      });
    };
    if (!document.getElementById("facebook-jssdk")) {
      const js = document.createElement("script");
      js.id = "facebook-jssdk";
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      js.async = true;
      js.defer = true;
      document.body.appendChild(js);
    }
    // Captura waba_id + phone_number_id enviados pelo Embedded Signup.
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      )
        return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
          sessionInfo.current = {
            waba_id: data.data?.waba_id,
            phone_number_id: data.data?.phone_number_id,
          };
        }
      } catch {
        /* mensagem não-JSON, ignora */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function finishConnect(response: any) {
    const code = response?.authResponse?.code;
    if (!code) {
      setError("Autorização cancelada ou sem retorno.");
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          wabaId: sessionInfo.current.waba_id,
          phoneNumberId: sessionInfo.current.phone_number_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Não foi possível conectar.");
      else await loadStatus();
    } catch {
      setError("Erro de rede ao conectar.");
    } finally {
      setConnecting(false);
    }
  }

  function connect() {
    setError("");
    if (!window.FB) {
      setError("SDK do Facebook ainda carregando. Tente de novo em instantes.");
      return;
    }
    try {
      // O callback precisa ser função comum: o SDK rejeita async function
      // ("Expression is of type asyncfunction") e nem chega a abrir o popup.
      window.FB.login(
        (response: any) => {
          void finishConnect(response);
        },
        {
          config_id: CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
        }
      );
    } catch (e) {
      // Sem isso, qualquer erro do SDK sobe do onClick e o botão parece morto.
      setError(
        e instanceof Error
          ? `Erro ao abrir o login do Facebook: ${e.message}`
          : "Erro ao abrir o login do Facebook."
      );
    }
  }

  const connected = !!status?.connected;

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <h2 className="font-semibold text-[var(--loop-text)]">WhatsApp</h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Conecte sua conta do WhatsApp Business (Cloud API) para enviar as
            mensagens de recuperação.
          </p>
        </div>
        <Badge variant={connected ? "success" : "default"}>
          {connected ? "Conectado" : "Não conectado"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {!FB_APP_ID ? (
          <p className="text-sm text-[var(--loop-error)]">
            Integração do WhatsApp ainda não configurada
            (NEXT_PUBLIC_FACEBOOK_APP_ID).
          </p>
        ) : !connected ? (
          <>
            <Button
              variant="cta"
              size="sm"
              disabled={connecting}
              onClick={connect}
            >
              {connecting ? "Conectando…" : "Conectar WhatsApp"}
            </Button>
            {error && (
              <p className="text-sm text-[var(--loop-error)]">{error}</p>
            )}
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--loop-border)] p-3">
                <p className="text-xs text-[var(--loop-text-muted)]">WABA</p>
                <p className="font-medium text-[var(--loop-text)]">
                  {status?.wabaId}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--loop-border)] p-3">
                <p className="text-xs text-[var(--loop-text-muted)]">
                  Número conectado
                </p>
                <p className="font-medium text-[var(--loop-text)]">
                  {status?.displayNumber || status?.phoneNumberId || "—"}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[var(--loop-text)]">
                Templates
              </p>
              {tplError ? (
                <p className="text-sm text-[var(--loop-error)]">{tplError}</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-[var(--loop-text-muted)]">
                  Nenhum template criado ainda.
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
