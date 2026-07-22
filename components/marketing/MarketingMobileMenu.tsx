"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { DemoDashboardButton } from "./DemoDashboardButton";

const LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#depoimentos", label: "Cases" },
];

export function MarketingMobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        className="rounded-lg p-2 text-[var(--loop-text)] hover:bg-[var(--loop-bg-alt)]"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
          />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop clicável abaixo do header */}
          <div
            className="fixed inset-0 top-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full z-50 flex flex-col gap-1 border-b border-[var(--loop-border)] bg-[var(--loop-bg)] p-4 shadow-lg">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[var(--loop-text)] hover:bg-[var(--loop-bg-alt)]"
              >
                {l.label}
              </a>
            ))}
            <hr className="my-2 border-[var(--loop-border)]" />
            <div onClick={() => setOpen(false)}>
              <DemoDashboardButton className="w-full" />
            </div>
            <Link href="/login" onClick={() => setOpen(false)} className="block">
              <Button variant="ghost" className="w-full">
                Entrar
              </Button>
            </Link>
            <Link
              href="/agendamento-demo"
              onClick={() => setOpen(false)}
              className="block"
            >
              <Button variant="cta" className="w-full">
                Agendar demo
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
