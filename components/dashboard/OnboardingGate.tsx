"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent } from "@/components/ui";
import { useOnboarding, ONBOARDING_ALLOWED } from "./OnboardingContext";

const PLATFORM_LABEL: Record<string, string> = {
  kiwify: "Kiwify",
  hotmart: "Hotmart",
};

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const state = useOnboarding();

  // Carregando o status: evita mostrar conteúdo antes de saber se está bloqueado.
  if (state.loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--loop-text-muted)]">
        Carregando…
      </div>
    );
  }

  // Liberado, ou numa página permitida durante o onboarding.
  if (state.onboarded || ONBOARDING_ALLOWED.includes(pathname)) {
    return <>{children}</>;
  }

  const label = state.platform ? PLATFORM_LABEL[state.platform] : "sua plataforma";

  // Integrações prontas, esperando o time LoopSale ativar.
  if (state.awaitingApproval) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <Card>
          <CardContent className="space-y-5 py-8 text-center">
            <div className="text-4xl">⏳</div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--loop-text)]">
                Ativação em andamento
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--loop-text-muted)]">
                {state.companyName ? `${state.companyName}, r` : "R"}ecebemos suas
                integrações! Nosso time está finalizando a configuração e
                validando as conexões. Assim que estiver tudo pronto, o painel
                libera automaticamente — você não precisa fazer nada.
              </p>
            </div>
            <p className="text-xs text-[var(--loop-text-muted)]">
              Isso costuma levar pouco tempo. Esta página atualiza sozinha quando
              for aprovada.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const steps = [
    { done: state.platformConnected, text: `Conectar sua conta ${label}` },
    { done: state.loopConnected, text: "Conectar a Loop API (envio das mensagens)" },
  ];

  return (
    <div className="mx-auto max-w-2xl py-6">
      <Card>
        <CardContent className="space-y-5 py-8 text-center">
          <div className="text-4xl">👋</div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--loop-text)]">
              Bem-vindo{state.companyName ? `, ${state.companyName}` : ""}!
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--loop-text-muted)]">
              Pra começar a recuperar vendas, conclua as integrações abaixo.
              Enquanto elas não estiverem ativas, o painel fica bloqueado.
            </p>
          </div>

          <ul className="mx-auto max-w-sm space-y-2 text-left text-sm">
            {steps.map((s) => (
              <li
                key={s.text}
                className={`flex items-center gap-2 ${
                  s.done
                    ? "text-[var(--loop-text-muted)]"
                    : "text-[var(--loop-text)]"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    s.done
                      ? "bg-[var(--loop-success)] text-white"
                      : "border border-[var(--loop-border)] text-[var(--loop-text-muted)]"
                  }`}
                >
                  {s.done ? "✓" : ""}
                </span>
                <span className={s.done ? "line-through" : ""}>{s.text}</span>
              </li>
            ))}
          </ul>

          <Link href="/dashboard/integracoes" className="inline-block">
            <Button variant="cta" size="lg">
              Ir para as integrações
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
