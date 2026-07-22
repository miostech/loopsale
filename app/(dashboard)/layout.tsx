import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/integracoes", label: "Integrações" },
  { href: "/dashboard/fluxos", label: "Fluxos" },
  { href: "/dashboard/clientes", label: "Clientes" },
  { href: "/dashboard/vendas", label: "Vendas" },
  { href: "/dashboard/campanhas", label: "Campanhas" },
  { href: "/dashboard/templates", label: "Templates" },
  { href: "/dashboard/configuracoes", label: "Configurações" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex bg-[var(--loop-bg-alt)]">
      <aside className="w-56 shrink-0 border-r border-[var(--loop-border)] bg-[var(--loop-bg)] flex flex-col">
        <div className="p-4 border-b border-[var(--loop-border)]">
          <LoopSaleLogo href="/dashboard" variant="full" />
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-lg text-[var(--loop-text)] hover:bg-[var(--loop-bg-alt)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-[var(--loop-border)]">
          <SignOutButton />
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardTopBar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
