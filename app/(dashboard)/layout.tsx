import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SidebarProvider } from "@/components/dashboard/SidebarContext";
import { OnboardingGate } from "@/components/dashboard/OnboardingGate";
import { OnboardingProvider } from "@/components/dashboard/OnboardingContext";
import { WelcomeTourModal } from "@/components/dashboard/WelcomeTourModal";
import { chatContext } from "@/lib/loopchat/access";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/integracoes", label: "Integrações" },
  { href: "/loopchat", label: "LoopChat" },
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

  // Com atendimento gerenciado quem responde é a LoopSale, então o LoopChat
  // nem aparece no menu — a página também redireciona, se alguém digitar a URL.
  const ctx = await chatContext();
  const navVisivel =
    ctx?.access === "hidden"
      ? nav.filter((n) => n.href !== "/loopchat")
      : nav;

  return (
    <SidebarProvider>
      <OnboardingProvider>
        <div className="min-h-screen flex bg-[var(--loop-bg-alt)]">
          <DashboardSidebar nav={navVisivel} />
          <div className="flex-1 flex flex-col min-w-0">
            <DashboardTopBar />
            <main className="flex-1 overflow-auto p-4 md:p-6">
              <OnboardingGate>{children}</OnboardingGate>
            </main>
          </div>
        </div>
        <WelcomeTourModal />
      </OnboardingProvider>
    </SidebarProvider>
  );
}
