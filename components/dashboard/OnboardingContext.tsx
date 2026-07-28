"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";

/**
 * Páginas que mostram conteúdo real durante o onboarding. As demais ficam
 * bloqueadas (o gate cobre o conteúdo e o menu mostra cadeado).
 * A home (/dashboard) exibe a tela de boas-vindas, então também é acessível.
 * Planos/assinatura só liberam após a ativação — não dá pra mudar plano antes.
 */
export const ONBOARDING_ALLOWED = ["/dashboard/integracoes"];

export interface OnboardingState {
  loading: boolean;
  onboarded: boolean;
  platform: "kiwify" | "hotmart" | null;
  companyName: string;
  platformConnected: boolean;
  loopConnected: boolean;
  awaitingApproval: boolean;
}

const OnboardingCtx = createContext<OnboardingState>({
  loading: true,
  onboarded: true,
  platform: null,
  companyName: "",
  platformConnected: true,
  loopConnected: true,
  awaitingApproval: false,
});

export function useOnboarding() {
  return useContext(OnboardingCtx);
}

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [state, setState] = useState<OnboardingState>({
    loading: true,
    onboarded: true,
    platform: null,
    companyName: "",
    platformConnected: true,
    loopConnected: true,
    awaitingApproval: false,
  });

  useEffect(() => {
    // Depois de liberado, não precisa checar de novo.
    if (!state.loading && state.onboarded) return;

    let active = true;
    const check = () => {
      fetch("/api/onboarding")
        .then((r) => r.json())
        .then((d) => {
          if (!active) return;
          setState({
            loading: false,
            onboarded: !!d.onboarded,
            platform: d.platform ?? null,
            companyName: d.companyName ?? "",
            platformConnected: !!d.platformConnected,
            loopConnected: !!d.loopConnected,
            awaitingApproval: !!d.awaitingApproval,
          });
        })
        .catch(() => {
          if (active) setState((s) => ({ ...s, loading: false, onboarded: true }));
        });
    };

    check();
    // Enquanto não liberado, re-checa a cada 20s (pega a aprovação do admin).
    const id = setInterval(check, 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pathname, state.loading, state.onboarded]);

  return (
    <OnboardingCtx.Provider value={state}>{children}</OnboardingCtx.Provider>
  );
}
