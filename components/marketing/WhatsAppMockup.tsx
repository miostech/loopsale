"use client";

import { useState, useEffect, useRef } from "react";

const AUTO_ADVANCE_MS = 4500;

type QuickAction = { label: string; primary?: boolean };

type ConversationScenario = {
  id: string;
  label: string;
  message: string;
  actions: QuickAction[];
};

const SCENARIOS: ConversationScenario[] = [
  {
    id: "checkout",
    label: "Checkout abandonado",
    message:
      "Oi, Maria! Vimos que você iniciou o checkout do curso e não finalizou. Você ficou com alguma dúvida? Se não ficou, podemos finalizar mantendo as mesmas condições é só clicar no botão abaixo.",
    actions: [
      { label: "Sim, quero finalizar", primary: true },
      { label: "Ver oferta" },
    ],
  },
  {
    id: "bonus",
    label: "Bônus pós-compra",
    message:
      "Parabéns pela compra, João! Você ganhou 15% de desconto na mentoria ao vivo. Esse cupom é válido por 24 horas.",
    actions: [
      { label: "Usar cupom", primary: true },
      { label: "Ver detalhes" },
    ],
  },
  {
    id: "acesso",
    label: "Código de acesso",
    message:
      "Olá! Seu pagamento foi confirmado. Aqui está o link da área de membros e o passo a passo para o primeiro acesso. Seja bem-vindo(a)! ",
    actions: [
      { label: "Entrar na área", primary: true },
      { label: "Falar com suporte" },
    ],
  },
  {
    id: "pix",
    label: "PIX / boleto",
    message:
      "Oi, Pedro! Notamos que o PIX do seu pedido ainda não foi identificado. Posso reenviar o QR Code?",
    actions: [
      { label: "Reenviar PIX", primary: true },
      { label: "Já paguei" },
    ],
  },
  {
    id: "nps",
    label: "Pesquisa NPS",
    message:
      "Oi, Ana! Em uma escala de 0 a 10, o quanto você recomendaria o curso para um amigo?",
    actions: [
      { label: "9 ou 10", primary: true },
      { label: "Responder depois" },
    ],
  },
  {
    id: "saudade",
    label: "Reengajamento",
    message:
      "Faz tempo que você não acessa o módulo 3. Quer retomar de onde parou? Separamos um resumo pra você.",
    actions: [
      { label: "Continuar curso", primary: true },
      { label: "Agendar revisão" },
    ],
  },
];

export function WhatsAppMockup() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const [autoPaused, setAutoPaused] = useState(false);
  const tablistRef = useRef<HTMLDivElement>(null);
  const active = SCENARIOS.find((s) => s.id === activeId) ?? SCENARIOS[0];

  useEffect(() => {
    if (autoPaused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      setActiveId((current) => {
        const i = SCENARIOS.findIndex((s) => s.id === current);
        const next = (i + 1) % SCENARIOS.length;
        return SCENARIOS[next].id;
      });
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [autoPaused]);

  useEffect(() => {
    const el = tablistRef.current?.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]'
    );
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: reduce ? "instant" : "smooth",
    });
  }, [activeId]);

  return (
    <div
      className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-2 sm:max-w-xl"
      onMouseEnter={() => setAutoPaused(true)}
      onMouseLeave={() => setAutoPaused(false)}
      onFocusCapture={() => setAutoPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setAutoPaused(false);
        }
      }}
    >
      <div
        ref={tablistRef}
        className="flex w-full gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Exemplos de conversa no WhatsApp (alternam automaticamente)"
      >
        {SCENARIOS.map((s) => {
          const selected = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(s.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 sm:text-sm ${
                selected
                  ? "border-[var(--loop-primary)] bg-[var(--loop-primary-muted)] text-[var(--loop-primary)] shadow-sm"
                  : "border-[var(--loop-border)] bg-[var(--loop-bg)] text-[var(--loop-text-muted)] hover:border-[color-mix(in_srgb,var(--loop-primary)_35%,var(--loop-border))] hover:text-[var(--loop-text)]"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="marketing-float w-full max-w-[280px] rounded-[2rem] border-[10px] border-[var(--loop-text)] bg-[var(--loop-bg-alt)] p-3 shadow-xl ring-1 ring-[color-mix(in_srgb,var(--loop-text)_12%,transparent)]">
        <div className="mb-2 flex items-center justify-between px-2 py-1 text-xs text-[var(--loop-text-muted)]">
          <span>9:41</span>
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          </span>
        </div>

        <div key={active.id} className="marketing-mock-swap">
          <div className="flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-[#e5e5ea] px-4 py-2.5 dark:bg-[#2d2d2d]">
              <p className="text-sm text-[var(--loop-text)]">{active.message}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {active.actions.map((a) =>
                  a.primary ? (
                    <span
                      key={a.label}
                      className="inline-flex items-center rounded-lg bg-[var(--loop-primary)] px-2.5 py-1 text-xs font-medium text-white"
                    >
                      {a.label}
                    </span>
                  ) : (
                    <span
                      key={a.label}
                      className="inline-flex items-center rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] px-2.5 py-1 text-xs font-medium text-[var(--loop-text)]"
                    >
                      {a.label}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
