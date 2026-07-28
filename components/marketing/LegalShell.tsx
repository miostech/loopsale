import Link from "next/link";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";

export function LegalShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--loop-bg)]">
      <header className="border-b border-[var(--loop-border)] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <LoopSaleLogo href="/" variant="full" />
          <Link
            href="/"
            className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
          >
            ← Início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold text-[var(--loop-text)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--loop-text-muted)]">
          Última atualização: {updatedAt}
        </p>
        <div className="legal-prose mt-8 space-y-5 text-[var(--loop-text)]">
          {children}
        </div>

        <div className="mt-12 border-t border-[var(--loop-border)] pt-6 text-sm text-[var(--loop-text-muted)]">
          <p>
            A LoopSale é uma plataforma operada por{" "}
            <a
              href="https://www.miostec.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--loop-text)] hover:text-[var(--loop-primary)] hover:underline"
            >
              MIOS
            </a>
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Link
              href="/politica-de-privacidade"
              className="hover:text-[var(--loop-text)]"
            >
              Política de privacidade
            </Link>
            <Link href="/termos-de-uso" className="hover:text-[var(--loop-text)]">
              Termos de uso
            </Link>
            <Link
              href="/exclusao-de-dados"
              className="hover:text-[var(--loop-text)]"
            >
              Exclusão de dados
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
