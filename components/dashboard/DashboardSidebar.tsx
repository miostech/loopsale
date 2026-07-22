"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { useSidebar } from "./SidebarContext";

type NavItem = { href: string; label: string };

export function DashboardSidebar({ nav }: { nav: NavItem[] }) {
  const { open, setOpen } = useSidebar();

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
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-[var(--loop-text)] hover:bg-[var(--loop-bg-alt)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-[var(--loop-border)] p-4">
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
