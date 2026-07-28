"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useOnboarding } from "./OnboardingContext";

interface Step {
  title: string;
  text: string;
  /** Item do menu que o passo destaca (ou null para intro/fim). */
  href?: string | null;
}

function buildSteps(companyName: string): Step[] {
  return [
    {
      title: "Conta ativa!",
      text: `Tudo pronto${companyName ? `, ${companyName}` : ""}! Sua conta foi ativada. Deixa a gente te mostrar rapidinho o que tem em cada tela.`,
    },
    {
      title: "Dashboard",
      text: "Sua visão geral: quanto foi recuperado, receita, taxa de conversão e os checkouts em risco.",
      href: "/dashboard",
    },
    {
      title: "Fluxos",
      text: "As automações que recuperam checkout abandonado no WhatsApp. Ajuste horários e mensagens de cada passo.",
      href: "/dashboard/fluxos",
    },
    {
      title: "Clientes",
      text: "Todos os seus leads e clientes, com o status de cada um no funil de recuperação.",
      href: "/dashboard/clientes",
    },
    {
      title: "Vendas",
      text: "As vendas recuperadas pela LoopSale, com valor, produto e origem.",
      href: "/dashboard/vendas",
    },
    {
      title: "Campanhas",
      text: "Disparos para a sua base: bônus, recompra e reengajamento.",
      href: "/dashboard/campanhas",
    },
    {
      title: "Templates",
      text: "As mensagens usadas nos fluxos e campanhas, com variáveis personalizadas.",
      href: "/dashboard/templates",
    },
    {
      title: "Comissão",
      text: "Quanto você paga pela recuperação, com o histórico de cobranças.",
      href: "/dashboard/comissao",
    },
    {
      title: "Bora recuperar vendas!",
      text: "É isso. Explore o painel no seu ritmo — qualquer dúvida, a gente está por aqui.",
    },
  ];
}

export function WelcomeTourModal() {
  const { onboarded, platform, welcomeSeen, companyName, setTourHighlight } =
    useOnboarding();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Só para contas que passaram pelo fluxo (têm plataforma), ativas e que ainda
  // não viram o tour.
  const show = onboarded && !!platform && !welcomeSeen && !dismissed;
  const steps = buildSteps(companyName);
  const currentHref = show ? steps[step]?.href ?? null : null;

  // Destaca no menu o item do passo atual (e limpa ao sair/desmontar).
  useEffect(() => {
    setTourHighlight(currentHref);
  }, [currentHref, setTourHighlight]);
  useEffect(() => () => setTourHighlight(null), [setTourHighlight]);

  if (!show) return null;

  const isLast = step === steps.length - 1;
  const current = steps[step];

  async function finish() {
    setTourHighlight(null);
    setDismissed(true);
    try {
      await fetch("/api/onboarding", { method: "POST" });
    } catch {
      /* não bloqueia se falhar */
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--loop-bg)] p-6 shadow-xl">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
          >
            Pular
          </button>
        </div>

        <div className="space-y-3 py-2 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--loop-text-muted)]">
            Passo {step + 1} de {steps.length}
          </p>
          <h2 className="text-xl font-bold text-[var(--loop-text)]">
            {current.title}
          </h2>
          <p className="mx-auto max-w-sm text-sm text-[var(--loop-text-muted)]">
            {current.text}
          </p>
        </div>

        {/* Indicadores */}
        <div className="my-4 flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-5 bg-[var(--loop-primary)]"
                  : "w-1.5 bg-[var(--loop-border)]"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)] disabled:invisible"
          >
            Anterior
          </button>
          {isLast ? (
            <Button variant="cta" onClick={finish}>
              Começar
            </Button>
          ) : (
            <Button variant="cta" onClick={() => setStep((s) => s + 1)}>
              Próximo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
