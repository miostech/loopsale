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
 */
export const ONBOARDING_ALLOWED = [
  "/dashboard/integracoes",
  "/dashboard/planos",
];

export interface OnboardingState {
  loading: boolean;
  onboarded: boolean;
  platform: "kiwify" | "hotmart" | null;
  companyName: string;
}

const OnboardingCtx = createContext<OnboardingState>({
  loading: true,
  onboarded: true,
  platform: null,
  companyName: "",
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
  });

  useEffect(() => {
    // Depois de liberado, não precisa checar de novo.
    if (!state.loading && state.onboarded) return;
    let active = true;
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setState({
          loading: false,
          onboarded: !!d.onboarded,
          platform: d.platform ?? null,
          companyName: d.companyName ?? "",
        });
      })
      .catch(() => {
        // Em erro, não trava o usuário.
        if (active) setState((s) => ({ ...s, loading: false, onboarded: true }));
      });
    return () => {
      active = false;
    };
  }, [pathname, state.loading, state.onboarded]);

  return (
    <OnboardingCtx.Provider value={state}>{children}</OnboardingCtx.Provider>
  );
}
