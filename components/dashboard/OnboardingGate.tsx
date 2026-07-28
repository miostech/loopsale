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
              Falta só um passo pra começar a recuperar vendas: conectar sua
              conta <strong>{label}</strong>. Enquanto a integração não estiver
              ativa, o painel fica bloqueado.
            </p>
          </div>

          <ol className="mx-auto max-w-sm space-y-2 text-left text-sm text-[var(--loop-text)]">
            <li className="flex gap-2">
              <span className="font-semibold text-[var(--loop-primary)]">1.</span>
              Conecte a integração com a {label}.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-[var(--loop-primary)]">2.</span>
              Configure o webhook na sua conta {label}.
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-[var(--loop-primary)]">3.</span>
              Pronto — o painel libera e começamos a recuperar checkouts.
            </li>
          </ol>

          <Link href="/dashboard/integracoes" className="inline-block">
            <Button variant="cta" size="lg">
              Conectar {label}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
