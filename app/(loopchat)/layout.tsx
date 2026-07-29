import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

/**
 * O LoopChat roda fora do shell do dashboard: é uma tela de trabalho, e a
 * sidebar do painel roubaria a largura das três colunas.
 */
export default async function LoopChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen flex-col bg-[var(--loop-bg)]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--loop-border)] px-4">
        <div className="flex items-center gap-3">
          <LoopSaleLogo href="/dashboard" variant="full" />
          <span className="rounded-full bg-[var(--loop-primary-muted)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--loop-primary)]">
            LoopChat
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="whitespace-nowrap text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
          >
            ← Voltar ao painel
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
