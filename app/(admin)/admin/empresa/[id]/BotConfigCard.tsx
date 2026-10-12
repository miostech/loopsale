"use client";

import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";

/** Limite de caracteres das Instruções e da Base (igual ao do backend). */
const LIMITE_TEXTO = 8000;

/**
 * Configuração do robô de atendimento (IA) da conta — só admin da LoopSale.
 * Liga/desliga, define a persona/instruções e a base de conhecimento.
 */
export function BotConfigCard({
  companyId,
  initialEnabled,
  initialInstructions,
  initialKnowledge,
  initialAutoResolveMinutes = 0,
  initialReplyDelaySeconds = 60,
  initialCloseOnFinish = false,
  initialLearnFromTeam = false,
  initialHandoffHours = {
    enabled: false,
    timezone: "Europe/Lisbon",
    days: [1, 2, 3, 4, 5],
    start: 9,
    end: 19,
  },
}: {
  companyId: string;
  initialEnabled: boolean;
  initialInstructions: string;
  initialKnowledge: string;
  initialAutoResolveMinutes?: number;
  initialReplyDelaySeconds?: number;
  initialCloseOnFinish?: boolean;
  initialLearnFromTeam?: boolean;
  initialHandoffHours?: {
    enabled: boolean;
    timezone: string;
    days: number[];
    start: number;
    end: number;
  };
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [knowledge, setKnowledge] = useState(initialKnowledge);
  const [autoResolveMinutes, setAutoResolveMinutes] = useState(
    initialAutoResolveMinutes
  );
  const [replyDelaySeconds, setReplyDelaySeconds] = useState(
    initialReplyDelaySeconds
  );
  const [closeOnFinish, setCloseOnFinish] = useState(initialCloseOnFinish);
  const [learnFromTeam, setLearnFromTeam] = useState(initialLearnFromTeam);
  // Horário do atendimento humano (janela de handoff).
  const [hhEnabled, setHhEnabled] = useState(initialHandoffHours.enabled);
  const [hhTimezone, setHhTimezone] = useState(initialHandoffHours.timezone);
  const [hhDays, setHhDays] = useState<number[]>(initialHandoffHours.days);
  const [hhStart, setHhStart] = useState(initialHandoffHours.start);
  const [hhEnd, setHhEnd] = useState(initialHandoffHours.end);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  async function salvar() {
    setMsg({});
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/empresa/${companyId}/bot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          instructions,
          knowledge,
          autoResolveMinutes,
          replyDelaySeconds,
          closeOnFinish,
          learnFromTeam,
          handoffHours: {
            enabled: hhEnabled,
            timezone: hhTimezone,
            days: hhDays,
            start: hhStart,
            end: hhEnd,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ err: data.error ?? "Não foi possível salvar." });
      else setMsg({ ok: "Configuração salva." });
    } catch {
      setMsg({ err: "Erro de rede ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Robô de atendimento (IA)
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Responde as conversas do WhatsApp automaticamente e repassa a um
            humano quando não souber. Gerenciado pela LoopSale.
          </p>
        </div>
        <Badge variant={enabled ? "success" : "default"}>
          {enabled ? "Ligado" : "Desligado"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--loop-text)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Responder automaticamente as mensagens desta conta
        </label>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
            Instruções / persona
          </label>
          <textarea
            rows={4}
            maxLength={LIMITE_TEXTO}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ex: Você é a Camila, do suporte comercial da Loja X. Seja cordial e objetiva. Nunca prometa desconto que não esteja na base. Foco em tirar dúvidas e ajudar a concluir a compra."
            className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-sm text-[var(--loop-text)] placeholder:text-[var(--loop-text-muted)]"
          />
          <p
            className={`mt-1 text-right text-xs ${
              instructions.length >= LIMITE_TEXTO
                ? "text-[var(--loop-error)]"
                : "text-[var(--loop-text-muted)]"
            }`}
          >
            {instructions.length.toLocaleString("pt-BR")} /{" "}
            {LIMITE_TEXTO.toLocaleString("pt-BR")} caracteres
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--loop-text)]">
            Base de conhecimento
          </label>
          <textarea
            rows={7}
            maxLength={LIMITE_TEXTO}
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            placeholder={
              "Cole aqui as informações que o robô pode usar: produtos, preços, prazos, política de reembolso, links, perguntas frequentes. O robô só responde com base no que estiver aqui."
            }
            className="w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-sm text-[var(--loop-text)] placeholder:text-[var(--loop-text-muted)]"
          />
          <p
            className={`mt-1 text-right text-xs ${
              knowledge.length >= LIMITE_TEXTO
                ? "text-[var(--loop-error)]"
                : "text-[var(--loop-text-muted)]"
            }`}
          >
            {knowledge.length.toLocaleString("pt-BR")} /{" "}
            {LIMITE_TEXTO.toLocaleString("pt-BR")} caracteres
          </p>
        </div>

        {/* Automação da caixa */}
        <div className="space-y-3 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-3">
          <p className="text-sm font-medium text-[var(--loop-text)]">
            Automação da caixa
          </p>
          <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--loop-text)]">
            Esperar
            <input
              type="number"
              min={0}
              max={600}
              value={replyDelaySeconds}
              onChange={(e) =>
                setReplyDelaySeconds(
                  Math.min(600, Math.max(0, Number(e.target.value) || 0))
                )
              }
              className="w-20 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2 py-1 text-[var(--loop-text)]"
            />
            segundos antes de responder
            <span className="text-xs text-[var(--loop-text-muted)]">
              (dá tempo da pessoa terminar de escrever; 0 = na hora; sugerido: 60)
            </span>
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--loop-text)]">
            Resolver sozinha após
            <input
              type="number"
              min={0}
              max={1440}
              value={autoResolveMinutes}
              onChange={(e) =>
                setAutoResolveMinutes(Math.max(0, Number(e.target.value) || 0))
              }
              className="w-20 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2 py-1 text-[var(--loop-text)]"
            />
            minutos sem resposta do cliente
            <span className="text-xs text-[var(--loop-text-muted)]">
              (0 = desligado; sugerido: 30)
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--loop-text)]">
            <input
              type="checkbox"
              checked={closeOnFinish}
              onChange={(e) => setCloseOnFinish(e.target.checked)}
              className="mt-1"
            />
            Fechar quando o cliente encerrar (agradeceu, se despediu) — precisa do
            robô ligado
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--loop-text)]">
            <input
              type="checkbox"
              checked={learnFromTeam}
              onChange={(e) => setLearnFromTeam(e.target.checked)}
              className="mt-1"
            />
            Aprender com as respostas da equipe (o robô passa a imitar o que vocês
            respondem no modo humano)
          </label>
        </div>

        {/* Horário do atendimento humano (janela de handoff) */}
        <div className="space-y-3 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm font-medium text-[var(--loop-text)]">
            <input
              type="checkbox"
              checked={hhEnabled}
              onChange={(e) => setHhEnabled(e.target.checked)}
              className="mt-1"
            />
            Limitar o repasse a um humano (handoff) a um horário
          </label>
          {hhEnabled && (
            <div className="space-y-3 pl-6">
              <div>
                <p className="mb-1 text-xs text-[var(--loop-text-muted)]">
                  Dias da semana
                </p>
                <div className="flex flex-wrap gap-1">
                  {[
                    { n: 1, l: "Seg" },
                    { n: 2, l: "Ter" },
                    { n: 3, l: "Qua" },
                    { n: 4, l: "Qui" },
                    { n: 5, l: "Sex" },
                    { n: 6, l: "Sáb" },
                    { n: 0, l: "Dom" },
                  ].map((d) => {
                    const on = hhDays.includes(d.n);
                    return (
                      <button
                        key={d.n}
                        type="button"
                        onClick={() =>
                          setHhDays((prev) =>
                            prev.includes(d.n)
                              ? prev.filter((x) => x !== d.n)
                              : [...prev, d.n]
                          )
                        }
                        className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                          on
                            ? "bg-[var(--loop-primary)] font-medium text-white"
                            : "border border-[var(--loop-border)] text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
                        }`}
                      >
                        {d.l}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex flex-wrap items-center gap-2 text-sm text-[var(--loop-text)]">
                Das
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hhStart}
                  onChange={(e) =>
                    setHhStart(Math.min(23, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className="w-16 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2 py-1 text-[var(--loop-text)]"
                />
                h às
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={hhEnd}
                  onChange={(e) =>
                    setHhEnd(Math.min(24, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className="w-16 rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2 py-1 text-[var(--loop-text)]"
                />
                h
              </label>
              <label className="block text-sm text-[var(--loop-text)]">
                Fuso horário
                <input
                  type="text"
                  value={hhTimezone}
                  onChange={(e) => setHhTimezone(e.target.value)}
                  placeholder="Europe/Lisbon"
                  className="mt-1 w-full rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-3 py-2 text-[var(--loop-text)]"
                />
                <span className="mt-1 block text-xs text-[var(--loop-text-muted)]">
                  Padrão: Europe/Lisbon. Ex.: America/Sao_Paulo, Europe/London.
                </span>
              </label>
              <p className="text-xs text-[var(--loop-text-muted)]">
                Fora desse horário, ao pedir atendente o robô avisa o horário e a
                conversa fica na fila (Aguardando humano) para a equipe retomar.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="cta" size="sm" disabled={saving} onClick={salvar}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          {msg.ok && (
            <span className="text-sm text-[var(--loop-success)]">{msg.ok}</span>
          )}
          {msg.err && (
            <span className="text-sm text-[var(--loop-error)]">{msg.err}</span>
          )}
        </div>

        <p className="rounded-md bg-[var(--loop-bg-alt)] p-2 text-xs text-[var(--loop-text-muted)]">
          Requer a chave de IA (ANTHROPIC_API_KEY) no ambiente. Sem ela, o robô
          não responde e as conversas seguem para o time humano.
        </p>
      </CardContent>
    </Card>
  );
}
