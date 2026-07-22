"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, Input } from "@/components/ui";

interface Flow {
  id: string;
  name: string;
  active: boolean;
  abandonmentMinutes: number;
  productId: string | null;
}

interface Step {
  delayMinutes: number;
  channel: string;
  templateId: string | null;
  templateBody: string | null;
  couponCode: string | null;
}

interface Template {
  id: string;
  name: string;
  channel: string;
  body: string;
}

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

function formatDelay(min: number): string {
  if (min <= 0) return "imediato";
  if (min % 1440 === 0) return `${min / 1440}d`;
  if (min % 60 === 0) return `${min / 60}h`;
  return `${min} min`;
}

export default function FluxosPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAbandon, setNewAbandon] = useState(30);
  const [creating, setCreating] = useState(false);

  // Editor de etapas
  const [editing, setEditing] = useState<Flow | null>(null);
  const [editName, setEditName] = useState("");
  const [editAbandon, setEditAbandon] = useState(30);
  const [editActive, setEditActive] = useState(true);
  const [steps, setSteps] = useState<Step[]>([]);
  const [savingFlow, setSavingFlow] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, tRes] = await Promise.all([
        fetch("/api/recovery-flows"),
        fetch("/api/message-templates"),
      ]);
      const f = await fRes.json();
      const t = await tRes.json();
      setFlows(Array.isArray(f) ? f : []);
      setTemplates(Array.isArray(t) ? t : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createFlow() {
    if (!newName.trim()) {
      setError("Dê um nome ao fluxo.");
      return;
    }
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/recovery-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          abandonmentMinutes: newAbandon,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Erro ao criar fluxo.");
        return;
      }
      setNewName("");
      setNewAbandon(30);
      setShowNew(false);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(f: Flow) {
    setBusyId(f.id);
    try {
      await fetch(`/api/recovery-flows/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !f.active }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeFlow(f: Flow) {
    if (!confirm(`Excluir o fluxo "${f.name}"?`)) return;
    setBusyId(f.id);
    try {
      await fetch(`/api/recovery-flows/${f.id}`, { method: "DELETE" });
      if (editing?.id === f.id) setEditing(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function openEditor(f: Flow) {
    setEditMsg("");
    setEditing(f);
    setEditName(f.name);
    setEditAbandon(f.abandonmentMinutes);
    setEditActive(f.active);
    setSteps([]);
    const res = await fetch(`/api/recovery-flows/${f.id}`);
    const data = await res.json();
    setSteps(
      (data.steps ?? []).map((s: Step) => ({
        delayMinutes: s.delayMinutes ?? 0,
        channel: s.channel ?? "whatsapp",
        templateId: s.templateId ?? null,
        templateBody: s.templateBody ?? null,
        couponCode: s.couponCode ?? null,
      }))
    );
  }

  function updateStep(i: number, patch: Partial<Step>) {
    setSteps((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((arr) => [
      ...arr,
      {
        delayMinutes: 1440,
        channel: "whatsapp",
        templateId: null,
        templateBody: "",
        couponCode: null,
      },
    ]);
  }
  function removeStep(i: number) {
    setSteps((arr) => arr.filter((_, idx) => idx !== i));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const copy = [...arr];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function saveFlow() {
    if (!editing) return;
    setSavingFlow(true);
    setEditMsg("");
    try {
      await fetch(`/api/recovery-flows/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          abandonmentMinutes: editAbandon,
          active: editActive,
        }),
      });
      await fetch(`/api/recovery-flows/${editing.id}/steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      setEditMsg("Fluxo salvo.");
      await load();
    } catch {
      setEditMsg("Erro ao salvar.");
    } finally {
      setSavingFlow(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--loop-text)]">
            Fluxos de recuperação
          </h1>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Sequências de mensagens disparadas (via Loop API) quando um carrinho
            é abandonado.
          </p>
        </div>
        <Button
          variant="cta"
          size="sm"
          onClick={() => {
            setShowNew((v) => !v);
            setError("");
          }}
        >
          {showNew ? "Fechar" : "Novo fluxo"}
        </Button>
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[var(--loop-text)]">Novo fluxo</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome"
                placeholder="ex: Recuperação padrão"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                label="Considerar abandonado após (min)"
                type="number"
                value={newAbandon}
                onChange={(e) => setNewAbandon(Number(e.target.value) || 0)}
              />
            </div>
            {error && <p className="text-sm text-[var(--loop-error)]">{error}</p>}
            <div className="flex items-center gap-2">
              <Button
                variant="cta"
                size="sm"
                disabled={creating}
                onClick={createFlow}
              >
                {creating ? "Criando…" : "Criar fluxo"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editor de etapas */}
      {editing && (
        <Card className="border-2 border-[var(--loop-primary)]">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <h2 className="font-semibold text-[var(--loop-text)]">
                Editar fluxo
              </h2>
              <p className="text-sm text-[var(--loop-text-muted)]">
                Defina as etapas: atraso, canal e mensagem.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Fechar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Nome"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <Input
                label="Abandonado após (min)"
                type="number"
                value={editAbandon}
                onChange={(e) => setEditAbandon(Number(e.target.value) || 0)}
              />
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                  Status
                </label>
                <select
                  value={editActive ? "1" : "0"}
                  onChange={(e) => setEditActive(e.target.value === "1")}
                  className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
                >
                  <option value="1">Ativo</option>
                  <option value="0">Pausado</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--loop-text)]">
                Etapas ({steps.length})
              </p>
              {steps.map((s, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--loop-border)] p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--loop-text)]">
                      Etapa {i + 1} · {formatDelay(s.delayMinutes)} após o
                      abandono
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => moveStep(i, -1)}
                        className="text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(i, 1)}
                        className="text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="text-[var(--loop-error)] hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      label="Atraso (min)"
                      type="number"
                      value={s.delayMinutes}
                      onChange={(e) =>
                        updateStep(i, {
                          delayMinutes: Number(e.target.value) || 0,
                        })
                      }
                    />
                    <div className="w-full">
                      <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                        Canal
                      </label>
                      <select
                        value={s.channel}
                        onChange={(e) =>
                          updateStep(i, { channel: e.target.value })
                        }
                        className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
                      >
                        {CHANNELS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full">
                      <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                        Template
                      </label>
                      <select
                        value={s.templateId ?? ""}
                        onChange={(e) => {
                          const tpl = templates.find(
                            (t) => t.id === e.target.value
                          );
                          updateStep(i, {
                            templateId: e.target.value || null,
                            templateBody: tpl ? tpl.body : s.templateBody,
                          });
                        }}
                        className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
                      >
                        <option value="">Mensagem própria</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
                      Mensagem
                    </label>
                    <textarea
                      rows={2}
                      value={s.templateBody ?? ""}
                      onChange={(e) =>
                        updateStep(i, { templateBody: e.target.value })
                      }
                      placeholder="Oi {{1}}, você esqueceu {{2}} no carrinho. Finalize: {{3}}"
                      className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)] placeholder:text-[var(--loop-text-muted)]"
                    />
                  </div>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={addStep}>
                + Adicionar etapa
              </Button>
            </div>

            <div className="flex items-center gap-3 border-t border-[var(--loop-border)] pt-4">
              <Button
                variant="cta"
                size="sm"
                disabled={savingFlow}
                onClick={saveFlow}
              >
                {savingFlow ? "Salvando…" : "Salvar fluxo"}
              </Button>
              {editMsg && (
                <span className="text-sm text-[var(--loop-success)]">
                  {editMsg}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">Seus fluxos</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-[var(--loop-text-muted)]">
              Carregando…
            </p>
          ) : flows.length === 0 ? (
            <p className="py-8 text-center text-[var(--loop-text-muted)]">
              Nenhum fluxo ainda. Crie o primeiro em “Novo fluxo”.
            </p>
          ) : (
            <div className="divide-y divide-[var(--loop-border)]">
              {flows.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium text-[var(--loop-text)]">
                      {f.name}
                    </p>
                    <p className="text-xs text-[var(--loop-text-muted)]">
                      Abandonado após {formatDelay(f.abandonmentMinutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={f.active ? "success" : "default"}>
                      {f.active ? "Ativo" : "Pausado"}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => openEditor(f)}
                      className="text-sm text-[var(--loop-primary)] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === f.id}
                      onClick={() => toggleActive(f)}
                      className="text-sm text-[var(--loop-primary)] hover:underline disabled:opacity-40"
                    >
                      {f.active ? "Pausar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === f.id}
                      onClick={() => removeFlow(f)}
                      className="text-sm text-[var(--loop-error)] hover:underline disabled:opacity-40"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
