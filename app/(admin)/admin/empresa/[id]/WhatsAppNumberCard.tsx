"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

interface MetaTemplate {
  name: string;
  status: string;
  language: string;
  category: string;
}

/**
 * Config de WhatsApp da empresa (individual). A empresa pode estar na WABA
 * CENTRAL da LoopSale (só o Phone Number ID, usa o token central) ou ter WABA
 * PRÓPRIA (WABA ID + chave de API dela). O envio resolve o token conforme isso.
 */
export function WhatsAppNumberCard({
  companyId,
  initialPhoneNumberId,
  initialDisplayNumber,
  initialSource,
  initialWabaId,
  hasOwnToken = false,
}: {
  companyId: string;
  initialPhoneNumberId: string;
  initialDisplayNumber: string;
  initialSource: string;
  initialWabaId: string;
  hasOwnToken?: boolean;
}) {
  const [source, setSource] = useState(initialSource === "own" ? "own" : "central");
  const [phoneNumberId, setPhoneNumberId] = useState(initialPhoneNumberId);
  const [displayNumber, setDisplayNumber] = useState(initialDisplayNumber);
  const [wabaId, setWabaId] = useState(initialWabaId);
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [templates, setTemplates] = useState<MetaTemplate[] | null>(null);
  const [tplErro, setTplErro] = useState("");
  const [sincronizando, setSincronizando] = useState(false);

  const own = source === "own";
  const connected = !!phoneNumberId;

  async function save() {
    setMsg({});
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/empresa/${companyId}/whatsapp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          phoneNumberId,
          displayNumber,
          wabaId: own ? wabaId : "",
          // Só envia o token se digitou um novo (write-only).
          accessToken: own ? accessToken : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ err: data.error ?? "Erro ao salvar." });
      else {
        setMsg({ ok: "Configuração salva." });
        setAccessToken("");
      }
    } catch {
      setMsg({ err: "Erro de rede." });
    } finally {
      setSaving(false);
    }
  }

  async function sincronizar() {
    setTplErro("");
    setTemplates(null);
    setSincronizando(true);
    try {
      const res = await fetch(`/api/admin/empresa/${companyId}/whatsapp/templates`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setTplErro(data.error ?? "Não foi possível sincronizar.");
      else {
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
        if (data.error) setTplErro(data.error);
      }
    } catch {
      setTplErro("Erro de rede ao sincronizar.");
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <h2 className="font-semibold text-[var(--loop-text)]">
            WhatsApp desta empresa
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Configuração individual: número, origem da WABA e credenciais.
          </p>
        </div>
        <Badge variant={connected ? "success" : "default"}>
          {connected ? "Número atribuído" : "Sem número"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Origem da WABA */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
            Origem da WABA
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] sm:w-auto"
          >
            <option value="central">WABA central da LoopSale (token central)</option>
            <option value="own">WABA própria do cliente (token próprio)</option>
          </select>
          <p className="mt-1 text-xs text-[var(--loop-text-muted)]">
            {own
              ? "Envia pela WABA e token desta empresa (o cliente paga a Meta)."
              : "Envia pela WABA central da LoopSale (a LoopSale paga a Meta)."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone Number ID"
            placeholder="ex: 123456789012345"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
          />
          <Input
            label="Número exibido (informativo)"
            placeholder="+55 11 99999-8888"
            value={displayNumber}
            onChange={(e) => setDisplayNumber(e.target.value)}
          />
        </div>

        {own && (
          <div className="grid gap-4 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-3 sm:grid-cols-2">
            <Input
              label="WABA ID (do cliente)"
              placeholder="ex: 987654321098765"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
            />
            <div>
              <Input
                label="Chave da API (token do cliente)"
                type="password"
                autoComplete="off"
                placeholder={hasOwnToken ? "•••••• (deixe em branco p/ manter)" : "EAAG…"}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--loop-text-muted)]">
                {hasOwnToken
                  ? "Já há um token salvo. Cole um novo só para trocar."
                  : "Cole o token de acesso desta WABA."}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button variant="cta" size="sm" disabled={saving} onClick={save}>
            {saving ? "Salvando…" : "Salvar configuração"}
          </Button>
          {msg.ok && (
            <span className="text-sm text-[var(--loop-success)]">{msg.ok}</span>
          )}
          {msg.err && (
            <span className="text-sm text-[var(--loop-error)]">{msg.err}</span>
          )}
        </div>

        {/* Modelos (templates) desta WABA */}
        <div className="border-t border-[var(--loop-border)] pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--loop-text)]">Modelos</p>
            <Button
              variant="secondary"
              size="sm"
              disabled={sincronizando || !connected}
              onClick={sincronizar}
            >
              {sincronizando ? "Sincronizando…" : "Sincronizar modelos"}
            </Button>
          </div>
          {tplErro && (
            <p className="mt-2 text-sm text-[var(--loop-error)]">{tplErro}</p>
          )}
          {templates !== null &&
            (templates.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--loop-text-muted)]">
                Nenhum modelo encontrado nesta WABA.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-[var(--loop-border)] rounded-lg border border-[var(--loop-border)]">
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
                    <span className="text-xs text-[var(--loop-text-muted)]">
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
