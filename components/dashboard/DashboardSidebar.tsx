"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { useSidebar } from "./SidebarContext";
import { useOnboarding, ONBOARDING_ALLOWED } from "./OnboardingContext";

type NavItem = { href: string; label: string };
type NavGroup = { title: string | null; items: NavItem[] };

export function DashboardSidebar({ nav }: { nav: NavGroup[] }) {
  const { open, setOpen } = useSidebar();
  const { loading, onboarded, tourHighlight } = useOnboarding();
  const tourActive = tourHighlight != null;
  const pathname = usePathname();

  // Página atual: exata na home, por prefixo nas demais (ex: /dashboard/vendas
  // e subrotas). Sem isso o menu não mostra onde você está.
  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Durante o onboarding, tudo fica bloqueado menos a home (tela de boas-vindas)
  // e as páginas liberadas (Integrações, Planos).
  function isLocked(href: string) {
    return (
      !loading &&
      !onboarded &&
      href !== "/dashboard" &&
      !ONBOARDING_ALLOWED.includes(href)
    );
  }

  // Fecha o drawer com Esc (só relevante no mobile).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      {/* Backdrop — só no mobile, quando aberto */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col border-r border-[var(--loop-border)] bg-[var(--loop-bg)] transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          tourActive ? "!z-[70] md:!relative md:!z-[70]" : ""
        } ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--loop-border)] p-4">
          <LoopSaleLogo href="/dashboard" variant="full" />
          {/* Fechar — só no mobile */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-[var(--loop-text-muted)] hover:bg-[var(--loop-bg-alt)] md:hidden"
            aria-label="Fechar menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-3 overflow-y-auto p-2">
          {nav.map((group, gi) => (
            <div key={group.title ?? `grupo-${gi}`} className="space-y-0.5">
              {group.title && (
                <p className="px-3 pb-0.5 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--loop-text-muted)]">
                  {group.title}
                </p>
              )}
              {group.items.map((item) =>
                isLocked(item.href) ? (
                  <div
                    key={item.href}
                    aria-disabled="true"
                    title="Conclua a integração para desbloquear"
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-[var(--loop-text-muted)] opacity-50 select-none"
                  >
                    <span>{item.label}</span>
                    <svg
                      className="h-3.5 w-3.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                ) : tourHighlight === item.href ? (
                  <div
                    key={item.href}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--loop-primary)] bg-[var(--loop-primary-muted)] px-3 py-2 font-medium text-[var(--loop-primary)]"
                  >
                    <span>{item.label}</span>
                    <span className="loop-tour-arrow text-lg leading-none">←</span>
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 transition-colors ${
                      isActive(item.href)
                        ? "bg-[var(--loop-primary-muted)] font-medium text-[var(--loop-primary)]"
                        : "text-[var(--loop-text)] hover:bg-[var(--loop-bg-alt)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </nav>
        <div className="border-t border-[var(--loop-border)] p-4">
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
