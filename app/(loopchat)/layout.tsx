import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { LoopChatPWA } from "./LoopChatPWA";

// PWA: nome do app, ícone do iOS e barra em tela cheia.
export const metadata: Metadata = {
  title: "LoopChat",
  appleWebApp: { capable: true, title: "LoopChat", statusBarStyle: "default" },
  icons: { apple: "/pwa/apple-180.png" },
};
// interactiveWidget "resizes-content": quando o teclado do celular sobe, o
// navegador encolhe a área da página (em vez de deixar 100dvh cheio), então o
// compositor e o botão Enviar continuam visíveis acima do teclado.
export const viewport: Viewport = {
  themeColor: "#6d28d9",
  interactiveWidget: "resizes-content",
};

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

  // No subdomínio dedicado (chat.<domínio>) o LoopChat é o app inteiro — não há
  // painel para "voltar", então esconde o link e o logo aponta pro próprio chat.
  const host = (await headers()).get("host") ?? "";
  const dedicado = host.startsWith("chat.");

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--loop-bg)]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--loop-border)] px-4">
        <div className="flex items-center gap-3">
          <LoopSaleLogo href={dedicado ? "/loopchat" : "/dashboard"} variant="full" />
          <span className="rounded-full bg-[var(--loop-primary-muted)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--loop-primary)]">
            LoopChat
          </span>
        </div>
        <div className="flex items-center gap-4">
          {!dedicado && (
            <Link
              href="/dashboard"
              className="whitespace-nowrap text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
            >
              ← Voltar ao painel
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
      <LoopChatPWA />
    </div>
  );
}
