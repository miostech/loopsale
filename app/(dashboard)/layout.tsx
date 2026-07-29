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
import { commissionRateOf } from "@/lib/billing/plans";

// Menu agrupado por área, para não ser uma lista solta de 11 itens.
const navGroups = [
  { title: null, items: [{ href: "/dashboard", label: "Dashboard" }] },
  {
    title: "Operação",
    items: [
      { href: "/dashboard/integracoes", label: "Integrações" },
      // LoopChat oculto por enquanto: com atendimento gerenciado para todos,
      // o self-service está em revisão. Reativar quando o formato for definido.
      // { href: "/loopchat", label: "LoopChat" },
      { href: "/dashboard/fluxos", label: "Fluxos" },
      // Campanhas oculto por enquanto: a tela existe mas não há processador que
      // execute as campanhas (nada lê a coleção `campaigns` para enviar). Quando
      // o motor de campanha existir, reativar esta linha.
      // { href: "/dashboard/campanhas", label: "Campanhas" },
      { href: "/dashboard/templates", label: "Templates" },
    ],
  },
  {
    title: "Clientes & Vendas",
    items: [
      { href: "/dashboard/clientes", label: "Clientes" },
      { href: "/dashboard/vendas", label: "Vendas" },
      { href: "/dashboard/comissao", label: "Comissão" },
    ],
  },
  {
    title: "Conta",
    items: [
      { href: "/dashboard/planos", label: "Planos e assinatura" },
      { href: "/dashboard/configuracoes", label: "Configurações" },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Comissão some para planos sem comissão (0%), senão mostraria uma tela de
  // zeros que só confunde. (Hoje todos os planos cobram comissão, então some
  // só se um plano 0% voltar a existir.)
  const ctx = await chatContext();
  const semComissao = commissionRateOf(ctx?.account?.subscription?.plan) === 0;
  const ocultar = new Set<string>();
  if (semComissao) ocultar.add("/dashboard/comissao");
  const navVisivel = navGroups.map((g) => ({
    ...g,
    items: g.items.filter((n) => !ocultar.has(n.href)),
  }));

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
