"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function DashboardTopBar() {
  const { data: session, status } = useSession();
  const name = session?.user?.name ?? session?.user?.email ?? "Usuário";
  const email = session?.user?.email ?? "";
  const role = (session?.user as { role?: string })?.role ?? "Membro";
  const initial = name.charAt(0).toUpperCase();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--loop-border)] bg-[var(--loop-bg)] px-6">
      <div className="flex items-center gap-4">
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
        </button>

        {status === "loading" ? (
          <div className="h-8 w-24 animate-pulse rounded bg-[var(--loop-border)]" />
        ) : (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex items-center gap-2 rounded-lg p-1 hover:bg-[var(--loop-bg-alt)]"
              aria-label="Menu do usuário"
            >
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-[var(--loop-text)]">
                  {name}
                </p>
                <p className="text-xs text-[var(--loop-text-muted)]">
                  {role === "admin" ? "Administrador" : "Membro"}
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--loop-primary-muted)] text-sm font-semibold text-[var(--loop-primary)]">
                {initial}
              </span>
              <svg
                className={`h-4 w-4 text-[var(--loop-text-muted)] transition-transform ${
                  open ? "rotate-180" : ""
                }`}
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

            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-[var(--loop-border)] bg-[var(--loop-bg)] shadow-lg"
              >
                <div className="border-b border-[var(--loop-border)] px-4 py-3">
                  <p className="truncate text-sm font-medium text-[var(--loop-text)]">
                    {name}
                  </p>
                  {email && (
                    <p className="truncate text-xs text-[var(--loop-text-muted)]">
                      {email}
                    </p>
                  )}
                </div>
                <Link
                  href="/dashboard/configuracoes"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-[var(--loop-text)] hover:bg-[var(--loop-bg-alt)]"
                >
                  Configurações
                </Link>
                <Link
                  href="/dashboard/configuracoes/planos"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-[var(--loop-text)] hover:bg-[var(--loop-bg-alt)]"
                >
                  Planos e assinatura
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    setOpen(false);
                    // redirect:false evita depender de NEXTAUTH_URL; navegamos
                    // para /login no mesmo host atual.
                    await signOut({ redirect: false });
                    window.location.assign("/login");
                  }}
                  className="block w-full border-t border-[var(--loop-border)] px-4 py-2 text-left text-sm text-[var(--loop-error)] hover:bg-[var(--loop-bg-alt)]"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
