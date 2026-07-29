"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

interface Template {
  id: string;
  channel: string;
  name: string;
  body: string;
  subject: string | null;
  metaTemplateName: string | null;
  metaStatus: string | null;
  language: string | null;
  variables: string[];
}

interface MetaTemplate {
  name: string;
  status: string;
  language: string;
  category: string;
  body: string;
  variableCount: number;
}

// Status da Meta → rótulo + cor do badge.
const META_STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "error" | "default" }
> = {
  APPROVED: { label: "Aprovado", variant: "success" },
  PENDING: { label: "Em análise", variant: "warning" },
  IN_APPEAL: { label: "Em recurso", variant: "warning" },
  REJECTED: { label: "Rejeitado", variant: "error" },
  DISABLED: { label: "Desativado", variant: "error" },
  PAUSED: { label: "Pausado", variant: "warning" },
};

function metaBadge(status: string) {
  return (
    META_STATUS[status.toUpperCase()] ?? {
      label: status,
      variant: "default" as const,
    }
  );
}

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
};

const empty = {
  id: "",
  channel: "whatsapp",
  name: "",
  metaTemplateName: "",
  language: "pt_BR",
  category: "UTILITY",
  submitToMeta: true,
  subject: "",
  body: "",
  variablesText: "",
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[] | null>(null);
  const [metaConnected, setMetaConnected] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/message-templates");
      const list = await res.json().catch(() => []);
      setTemplates(Array.isArray(list) ? list : []);
    } catch {
      setError("Erro ao carregar templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/templates");
      const data = await res.json().catch(() => ({}));
      setMetaTemplates(Array.isArray(data.templates) ? data.templates : []);
      setMetaConnected(data.connected !== false);
    } catch {
      setMetaTemplates([]);
    }
  }, []);

  useEffect(() => {
    load();
    loadMeta();
  }, [load, loadMeta]);

  function openNew() {
    setForm({ ...empty });
    setError("");
    setShowForm(true);
  }

  function openEdit(t: Template) {
    setForm({
      id: t.id,
      channel: t.channel,
      name: t.name,
      metaTemplateName: t.metaTemplateName ?? "",
      language: t.language ?? "pt_BR",
      category: "UTILITY",
      submitToMeta: false, // editar não reenvia à Meta
      subject: t.subject ?? "",
      body: t.body,
      variablesText: (t.variables ?? []).join(", "),
    });
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim() || !form.body.trim()) {
      setError("Preencha o nome e o corpo do template.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        channel: form.channel,
        name: form.name.trim(),
        body: form.body.trim(),
        subject: form.subject.trim(),
        metaTemplateName: form.metaTemplateName.trim(),
        language: form.language.trim(),
        category: form.category,
        // Só submete à Meta em criação nova de WhatsApp com a opção marcada.
        submitToMeta:
          !form.id && form.channel === "whatsapp" && form.submitToMeta,
        variables: form.variablesText
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      };
      const res = await fetch(
        form.id ? `/api/message-templates/${form.id}` : "/api/message-templates",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o template.");
        return;
      }
      setShowForm(false);
      setForm({ ...empty });
      await Promise.all([load(), loadMeta()]);
    } catch {
      setError("Erro de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Template) {
    if (!confirm(`Excluir o template "${t.name}"?`)) return;
    setBusyId(t.id);
    try {
      await fetch(`/api/message-templates/${t.id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("Erro ao excluir.");
    } finally {
      setBusyId(null);
    }
  }

  const isWhatsapp = form.channel === "whatsapp";
  const isEmail = form.channel === "email";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--loop-text)]">
            Templates de mensagem
          </h1>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Mensagens reutilizáveis. No WhatsApp, dá para enviar o template
            direto para aprovação na Meta e acompanhar o status abaixo.
          </p>
        </div>
        <Button variant="cta" size="sm" onClick={openNew}>
          Novo template
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[var(--loop-text)]">
              {form.id ? "Editar template" : "Novo template"}
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome (interno)"
                placeholder="ex: Recuperação carrinho 1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                  Canal
                </label>
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
                >
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {isWhatsapp && (
                <>
                  <Input
                    label="Nome do template na Meta"
                    placeholder="ex: recuperacao_carrinho"
                    value={form.metaTemplateName}
                    onChange={(e) =>
                      setForm({ ...form, metaTemplateName: e.target.value })
                    }
                  />
                  <Input
                    label="Idioma (Meta)"
                    placeholder="pt_BR"
                    value={form.language}
                    onChange={(e) =>
                      setForm({ ...form, language: e.target.value })
                    }
                  />
                  {!form.id && form.submitToMeta && (
                    <div className="w-full">
                      <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                        Categoria (Meta)
                      </label>
                      <select
                        value={form.category}
                        onChange={(e) =>
                          setForm({ ...form, category: e.target.value })
                        }
                        className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
                      >
                        <option value="UTILITY">Utilitário (transacional)</option>
                        <option value="MARKETING">Marketing (promocional)</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {isEmail && (
                <Input
                  label="Assunto"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              )}
            </div>

            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                Corpo da mensagem
              </label>
              <textarea
                rows={4}
                placeholder="Oi {{1}}, vi que você deixou {{2}} no carrinho. Finalize aqui: {{3}}"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] placeholder:text-[var(--loop-text-muted)]"
              />
              <p className="mt-1 text-xs text-[var(--loop-text-muted)]">
                Use {"{{1}}"}, {"{{2}}"}… para as variáveis do template.
              </p>
            </div>

            {isWhatsapp && (
              <Input
                label="Variáveis (o que cada {{n}} significa, separadas por vírgula)"
                placeholder="nome do cliente, produto, link do checkout"
                value={form.variablesText}
                onChange={(e) =>
                  setForm({ ...form, variablesText: e.target.value })
                }
              />
            )}

            {isWhatsapp && !form.id && (
              <div className="rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-3">
                <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--loop-text)]">
                  <input
                    type="checkbox"
                    checked={form.submitToMeta}
                    onChange={(e) =>
                      setForm({ ...form, submitToMeta: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>
                    Enviar para aprovação na Meta agora
                    <span className="mt-0.5 block text-xs text-[var(--loop-text-muted)]">
                      {form.submitToMeta
                        ? "O template será criado na sua WABA e entra em análise (leva de minutos a horas). Os rótulos das variáveis viram os exemplos exigidos pela Meta."
                        : "Desmarcado: só salva aqui e referencia um template que você já aprovou na Meta (preencha o nome exato acima)."}
                    </span>
                  </span>
                </label>
              </div>
            )}

            {error && <p className="text-sm text-[var(--loop-error)]">{error}</p>}
            <div className="flex items-center gap-2">
              <Button variant="cta" size="sm" disabled={saving} onClick={save}>
                {saving ? "Salvando…" : "Salvar template"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setForm({ ...empty });
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Seus templates
          </h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-[var(--loop-text-muted)]">
              Carregando…
            </p>
          ) : templates.length === 0 ? (
            <p className="py-8 text-center text-[var(--loop-text-muted)]">
              Nenhum template ainda. Crie o primeiro em “Novo template”.
            </p>
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-[var(--loop-border)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--loop-text)]">
                          {t.name}
                        </span>
                        <Badge variant="primary">
                          {CHANNEL_LABEL[t.channel] ?? t.channel}
                        </Badge>
                        {t.metaTemplateName && (
                          <Badge variant="default">
                            Meta: {t.metaTemplateName}
                            {t.language ? ` (${t.language})` : ""}
                          </Badge>
                        )}
                        {t.metaStatus && (
                          <Badge variant={metaBadge(t.metaStatus).variant}>
                            {metaBadge(t.metaStatus).label}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-[var(--loop-text-muted)]">
                        {t.body}
                      </p>
                      {t.variables?.length > 0 && (
                        <p className="mt-1 text-xs text-[var(--loop-text-muted)]">
                          Variáveis: {t.variables.join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="text-sm text-[var(--loop-primary)] hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={busyId === t.id}
                        onClick={() => remove(t)}
                        className="text-sm text-[var(--loop-error)] hover:underline disabled:opacity-40"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Templates no WhatsApp (Meta)
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            O que existe na sua conta do WhatsApp, com o status de aprovação da
            Meta.
          </p>
        </CardHeader>
        <CardContent>
          {metaTemplates === null ? (
            <p className="py-8 text-center text-sm text-[var(--loop-text-muted)]">
              Carregando…
            </p>
          ) : !metaConnected ? (
            <p className="py-8 text-center text-sm text-[var(--loop-text-muted)]">
              Conecte um WhatsApp em Integrações para ver seus templates da Meta.
            </p>
          ) : metaTemplates.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--loop-text-muted)]">
              Nenhum template na Meta ainda. Crie um em “Novo template” com a
              opção de enviar para aprovação.
            </p>
          ) : (
            <div className="space-y-2">
              {metaTemplates.map((m) => (
                <div
                  key={`${m.name}-${m.language}`}
                  className="rounded-lg border border-[var(--loop-border)] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--loop-text)]">
                      {m.name}
                    </span>
                    <Badge variant={metaBadge(m.status).variant}>
                      {metaBadge(m.status).label}
                    </Badge>
                    <Badge variant="default">{m.language}</Badge>
                    {m.category && (
                      <Badge variant="default">{m.category}</Badge>
                    )}
                  </div>
                  {m.body && (
                    <p className="mt-1 truncate text-sm text-[var(--loop-text-muted)]">
                      {m.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
