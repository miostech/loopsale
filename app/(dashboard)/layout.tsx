import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SidebarProvider } from "@/components/dashboard/SidebarContext";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/integracoes", label: "Integrações" },
  { href: "/dashboard/fluxos", label: "Fluxos" },
  { href: "/dashboard/clientes", label: "Clientes" },
  { href: "/dashboard/vendas", label: "Vendas" },
  { href: "/dashboard/campanhas", label: "Campanhas" },
  { href: "/dashboard/templates", label: "Templates" },
  { href: "/dashboard/planos", label: "Planos e assinatura" },
  { href: "/dashboard/comissao", label: "Comissão" },
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
    <SidebarProvider>
      <div className="min-h-screen flex bg-[var(--loop-bg-alt)]">
        <DashboardSidebar nav={nav} />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardTopBar />
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
