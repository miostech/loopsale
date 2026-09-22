"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

interface MetaTemplate {
  name: string;
  status: string;
  language: string;
  category: string;
}

export interface ChannelForm {
  name: string;
  source: string;
  phoneNumberId: string;
  displayNumber: string;
  wabaId: string;
  hasToken: boolean;
}

type Linha = ChannelForm & { accessToken: string };

function linhaVazia(): Linha {
  return {
    name: "",
    source: "central",
    phoneNumberId: "",
    displayNumber: "",
    wabaId: "",
    hasToken: false,
    accessToken: "",
  };
}

/**
 * Config de WhatsApp da empresa (individual). A empresa pode ter VÁRIOS números
 * (caixas), cada um na WABA central da LoopSale (só o Phone Number ID, usa o
 * token central) ou em WABA própria (WABA ID + token dela). Cada número vira uma
 * caixa separada no LoopChat.
 */
export function WhatsAppNumberCard({
  companyId,
  initialChannels,
}: {
  companyId: string;
  initialChannels: ChannelForm[];
}) {
  const [linhas, setLinhas] = useState<Linha[]>(
    initialChannels.length
      ? initialChannels.map((c) => ({ ...c, accessToken: "" }))
      : [linhaVazia()]
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  // Templates e estado do "sincronizar" por número (chave = índice).
  const [templates, setTemplates] = useState<Record<number, MetaTemplate[]>>({});
  const [tplErro, setTplErro] = useState<Record<number, string>>({});
  const [sincronizando, setSincronizando] = useState<number | null>(null);

  function atualizar(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function adicionar() {
    setLinhas((ls) => [...ls, linhaVazia()]);
  }
  function remover(i: number) {
    setLinhas((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    setMsg({});
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/empresa/${companyId}/whatsapp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: linhas.map((l) => ({
            name: l.name,
            source: l.source,
            phoneNumberId: l.phoneNumberId,
            displayNumber: l.displayNumber,
            wabaId: l.wabaId,
            accessToken: l.accessToken, // vazio = mantém o atual
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ err: data.error ?? "Erro ao salvar." });
      else {
        setMsg({ ok: "Números salvos." });
        // Token virou write-only de novo; marca quem passou a ter token.
        setLinhas((ls) =>
          ls.map((l) => ({
            ...l,
            hasToken: l.source === "own" ? l.hasToken || !!l.accessToken : false,
            accessToken: "",
          }))
        );
      }
    } catch {
      setMsg({ err: "Erro de rede." });
    } finally {
      setSaving(false);
    }
  }

  async function sincronizar(i: number, phoneNumberId: string) {
    setTplErro((e) => ({ ...e, [i]: "" }));
    setTemplates((t) => {
      const cp = { ...t };
      delete cp[i];
      return cp;
    });
    setSincronizando(i);
    try {
      const res = await fetch(
        `/api/admin/empresa/${companyId}/whatsapp/templates?channel=${encodeURIComponent(
          phoneNumberId
        )}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setTplErro((e) => ({ ...e, [i]: data.error ?? "Não foi possível sincronizar." }));
      else {
        setTemplates((t) => ({
          ...t,
          [i]: Array.isArray(data.templates) ? data.templates : [],
        }));
        if (data.error) setTplErro((e) => ({ ...e, [i]: data.error }));
      }
    } catch {
      setTplErro((e) => ({ ...e, [i]: "Erro de rede ao sincronizar." }));
    } finally {
      setSincronizando(null);
    }
  }

  const totalConectados = linhas.filter((l) => l.phoneNumberId.trim()).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Números de WhatsApp
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Cada número é uma caixa separada no LoopChat (ex.: Suporte, Dome).
          </p>
        </div>
        <Badge variant={totalConectados ? "success" : "default"}>
          {totalConectados
            ? `${totalConectados} número${totalConectados > 1 ? "s" : ""}`
            : "Sem número"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {linhas.map((l, i) => {
          const own = l.source === "own";
          const conectado = !!l.phoneNumberId.trim();
          const tpls = templates[i];
          return (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-[var(--loop-border)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    label="Nome da caixa"
                    placeholder="ex: Suporte, Dome"
                    value={l.name}
                    onChange={(e) => atualizar(i, { name: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remover(i)}
                  className="mt-6 shrink-0 rounded-md px-2 py-1 text-xs text-[var(--loop-text-muted)] hover:text-[var(--loop-error)]"
                >
                  Remover
                </button>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                  Origem da WABA
                </label>
                <select
                  value={l.source}
                  onChange={(e) => atualizar(i, { source: e.target.value })}
                  className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] sm:w-auto"
                >
                  <option value="central">WABA central da LoopSale (token central)</option>
                  <option value="own">WABA própria do cliente (token próprio)</option>
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Phone Number ID"
                  placeholder="ex: 123456789012345"
                  value={l.phoneNumberId}
                  onChange={(e) => atualizar(i, { phoneNumberId: e.target.value })}
                />
                <Input
                  label="Número exibido (informativo)"
                  placeholder="+55 11 5304-2686"
                  value={l.displayNumber}
                  onChange={(e) => atualizar(i, { displayNumber: e.target.value })}
                />
              </div>

              {own && (
                <div className="grid gap-4 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-3 sm:grid-cols-2">
                  <Input
                    label="WABA ID (do cliente)"
                    placeholder="ex: 987654321098765"
                    value={l.wabaId}
                    onChange={(e) => atualizar(i, { wabaId: e.target.value })}
                  />
                  <div>
                    <Input
                      label="Chave da API (token do cliente)"
                      type="password"
                      autoComplete="off"
                      placeholder={l.hasToken ? "•••••• (deixe em branco p/ manter)" : "EAAG…"}
                      value={l.accessToken}
                      onChange={(e) => atualizar(i, { accessToken: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-[var(--loop-text-muted)]">
                      {l.hasToken
                        ? "Já há um token salvo. Cole um novo só para trocar."
                        : "Cole o token de acesso desta WABA."}
                    </p>
                  </div>
                </div>
              )}

              {/* Modelos (templates) desta WABA */}
              <div className="border-t border-[var(--loop-border)] pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--loop-text)]">Modelos</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={sincronizando === i || !conectado}
                    onClick={() => sincronizar(i, l.phoneNumberId.trim())}
                  >
                    {sincronizando === i ? "Sincronizando…" : "Sincronizar modelos"}
                  </Button>
                </div>
                {tplErro[i] && (
                  <p className="mt-2 text-sm text-[var(--loop-error)]">{tplErro[i]}</p>
                )}
                {tpls !== undefined &&
                  (tpls.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--loop-text-muted)]">
                      Nenhum modelo encontrado nesta WABA.
                    </p>
                  ) : (
                    <div className="mt-2 divide-y divide-[var(--loop-border)] rounded-lg border border-[var(--loop-border)]">
                      {tpls.map((t) => (
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
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={adicionar}>
            + Adicionar número
          </Button>
          <Button variant="cta" size="sm" disabled={saving} onClick={salvar}>
            {saving ? "Salvando…" : "Salvar números"}
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
  );
}
