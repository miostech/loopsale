import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  // Área exclusiva do dono da LoopSale — quem não é super-admin volta pro app.
  if (!isSuperAdmin(session.user?.email)) redirect("/dashboard");

  // Pedidos de número esperando o time: vira contador no menu, senão o pedido
  // fica só no banco e ninguém fica sabendo que o cliente pagou.
  let numerosPendentes = 0;
  if (!isDatabaseDisabled()) {
    try {
      const col = await getCollection("numberRequests");
      numerosPendentes = await col.countDocuments({
        status: { $in: ["pending", "provisioning"] },
      });
    } catch {
      /* menu não deve derrubar a página do admin */
    }
  }

  return (
    <div className="min-h-screen bg-[var(--loop-bg-alt)]">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--loop-border)] bg-[var(--loop-bg)] px-4 md:px-6">
        <div className="flex items-center gap-3">
          <LoopSaleLogo href="/admin" variant="full" />
          <span className="rounded-full bg-[var(--loop-primary-muted)] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--loop-primary)]">
            Admin
          </span>
          <nav className="ml-2 hidden items-center gap-4 sm:flex">
            <Link
              href="/admin"
              className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
            >
              Empresas
            </Link>
            <Link
              href="/admin/ativacoes"
              className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
            >
              Ativações
            </Link>
            <Link
              href="/admin/leads"
              className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
            >
              Leads
            </Link>
            <Link
              href="/admin/numeros"
              className="flex items-center gap-1.5 text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
            >
              Números
              {numerosPendentes > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--loop-primary)] px-1.5 text-xs font-semibold text-white">
                  {numerosPendentes}
                </span>
              )}
            </Link>
            <Link
              href="/meta-review"
              className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
            >
              Meta ↗
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
          >
            Ir para o app →
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
