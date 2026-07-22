"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

interface Campaign {
  id: string;
  name: string;
  type: string;
  segmentId: string | null;
  templateId: string | null;
  startAt: string | null;
  endAt: string | null;
  active: boolean;
}

interface Segment {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  channel: string;
}

const TYPES = [
  { value: "launch", label: "Lançamento" },
  { value: "recovery_old", label: "Recuperação de leads" },
  { value: "upsell", label: "Upsell" },
  { value: "limited_offer", label: "Oferta limitada" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPES.map((t) => [t.value, t.label])
);

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function periodo(c: Campaign): string {
  if (!c.startAt && !c.endAt) return "—";
  return `${formatDate(c.startAt)} → ${formatDate(c.endAt)}`;
}

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("recovery_old");
  const [segmentId, setSegmentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes, tRes] = await Promise.all([
        fetch("/api/campaigns"),
        fetch("/api/segments"),
        fetch("/api/message-templates"),
      ]);
      const c = await cRes.json().catch(() => []);
      const s = await sRes.json().catch(() => []);
      const t = await tRes.json().catch(() => []);
      setCampaigns(Array.isArray(c) ? c : []);
      setSegments(Array.isArray(s) ? s : []);
      setTemplates(Array.isArray(t) ? t : []);
    } catch {
      setError("Erro ao carregar campanhas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setName("");
    setType("recovery_old");
    setSegmentId("");
    setTemplateId("");
    setStartAt("");
    setEndAt("");
  }

  async function createCampaign() {
    if (!name.trim()) {
      setError("Dê um nome à campanha.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          segmentId: segmentId || null,
          templateId: templateId || null,
          startAt: startAt || null,
          endAt: endAt || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível criar a campanha.");
        return;
      }
      resetForm();
      setShowForm(false);
      await load();
    } catch {
      setError("Erro de rede ao criar a campanha.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: Campaign) {
    setBusyId(c.id);
    try {
      await fetch(`/api/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      await load();
    } catch {
      setError("Erro ao atualizar a campanha.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: Campaign) {
    if (!confirm(`Excluir a campanha "${c.name}"? Esta ação não pode ser desfeita.`))
      return;
    setBusyId(c.id);
    try {
      await fetch(`/api/campaigns/${c.id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("Erro ao excluir a campanha.");
    } finally {
      setBusyId(null);
    }
  }

  const ativas = campaigns.filter((c) => c.active).length;
  const segmentName = (id: string | null) =>
    id ? segments.find((s) => s.id === id)?.name ?? "Segmento removido" : "Todos os leads";
  const templateName = (id: string | null) =>
    id ? templates.find((t) => t.id === id)?.name ?? "Template removido" : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--loop-text)]">
            Campanhas
          </h1>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Lançamentos, recuperação de leads antigos, upsell e ofertas por
            segmento.
          </p>
        </div>
        <Button
          variant="cta"
          size="sm"
          onClick={() => {
            setShowForm((v) => !v);
            setError("");
          }}
        >
          {showForm ? "Fechar" : "Nova campanha"}
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-[var(--loop-text-muted)]">Total</p>
            <p className="mt-1 text-2xl font-bold text-[var(--loop-text)]">
              {campaigns.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-[var(--loop-text-muted)]">Ativas</p>
            <p className="mt-1 text-2xl font-bold text-[var(--loop-success)]">
              {ativas}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-[var(--loop-text-muted)]">Pausadas</p>
            <p className="mt-1 text-2xl font-bold text-[var(--loop-text)]">
              {campaigns.length - ativas}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[var(--loop-text)]">
              Nova campanha
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome"
                placeholder="ex: Recuperação Black Friday"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                  Tipo
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                  Segmento
                </label>
                <select
                  value={segmentId}
                  onChange={(e) => setSegmentId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
                >
                  <option value="">Todos os leads</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                  Mensagem (template)
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
                >
                  <option value="">Sem template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="mt-1 text-xs text-[var(--loop-text-muted)]">
                    Nenhum template ainda — crie em{" "}
                    <a
                      href="/dashboard/templates"
                      className="text-[var(--loop-primary)] hover:underline"
                    >
                      Templates
                    </a>
                    .
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Início"
                  type="date"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
                <Input
                  label="Fim"
                  type="date"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <p className="text-sm text-[var(--loop-error)]">{error}</p>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="cta"
                size="sm"
                disabled={saving}
                onClick={createCampaign}
              >
                {saving ? "Criando…" : "Criar campanha"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Suas campanhas
          </h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-[var(--loop-text-muted)]">
              Carregando…
            </p>
          ) : campaigns.length === 0 ? (
            <p className="py-8 text-center text-[var(--loop-text-muted)]">
              Nenhuma campanha ainda. Crie a primeira em “Nova campanha”.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--loop-border)] text-left text-[var(--loop-text-muted)]">
                    <th className="pb-2 pr-4 font-medium">Nome</th>
                    <th className="pb-2 pr-4 font-medium">Tipo</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Segmento</th>
                    <th className="pb-2 pr-4 font-medium">Mensagem</th>
                    <th className="pb-2 pr-4 font-medium">Período</th>
                    <th className="pb-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-[var(--loop-border)]"
                    >
                      <td className="py-3 pr-4 text-[var(--loop-text)]">
                        {c.name}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="primary">
                          {TYPE_LABEL[c.type] ?? c.type}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={c.active ? "success" : "default"}>
                          {c.active ? "Ativa" : "Pausada"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-[var(--loop-text)]">
                        {segmentName(c.segmentId)}
                      </td>
                      <td className="py-3 pr-4 text-[var(--loop-text)]">
                        {templateName(c.templateId)}
                      </td>
                      <td className="py-3 pr-4 text-[var(--loop-text-muted)]">
                        {periodo(c)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => toggleActive(c)}
                            className="text-[var(--loop-primary)] hover:underline disabled:opacity-40"
                          >
                            {c.active ? "Pausar" : "Ativar"}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => remove(c)}
                            className="text-[var(--loop-error)] hover:underline disabled:opacity-40"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
