"use client";

import { useSession } from "next-auth/react";

export function DashboardTopBar() {
  const { data: session, status } = useSession();
  const name = session?.user?.name ?? session?.user?.email ?? "Usuário";
  const role = (session?.user as { role?: string })?.role ?? "Membro";
  const initial = name.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--loop-border)] bg-[var(--loop-bg)] px-6">
      <div className="flex items-center gap-4">
        {/* Placeholder para dropdown "Visão Geral" - pode ser expandido depois */}
        <span className="text-sm font-medium text-[var(--loop-text-muted)]">
          Visão geral
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative rounded-lg p-2 text-[var(--loop-text-muted)] hover:bg-[var(--loop-bg-alt)] hover:text-[var(--loop-text)]"
          aria-label="Notificações"
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
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--loop-cta)] text-[10px] font-bold text-white">
            0
          </span>
        </button>
        {status === "loading" ? (
          <div className="h-8 w-24 animate-pulse rounded bg-[var(--loop-border)]" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-[var(--loop-text)]">
                {name}
              </p>
              <p className="text-xs text-[var(--loop-text-muted)]">
                {role === "admin" ? "Administrador" : "Membro"}
              </p>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg p-1 hover:bg-[var(--loop-bg-alt)]"
              aria-label="Menu do usuário"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--loop-primary-muted)] text-sm font-semibold text-[var(--loop-primary)]">
                {initial}
              </span>
              <svg
                className="h-4 w-4 text-[var(--loop-text-muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
