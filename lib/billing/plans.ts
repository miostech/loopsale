/**
 * Planos da LoopSale. Os priceId vêm do Stripe (env) — cada plano pago mapeia
 * um Price recorrente criado no painel do Stripe. Ajuste preços/limites à
 * vontade; a UI e o checkout leem daqui.
 *
 * Modelo: Free é performance (sem mensalidade, 30% sobre vendas recuperadas);
 * os planos pagos são mensalidade fixa e SEM comissão.
 */
export type Plan = {
  id: string;
  name: string;
  /** Preço mensal em BRL (0 = grátis). Apenas exibição. */
  priceMonthly: number;
  /** Nota abaixo do preço (ex: comissão do Free). */
  priceNote?: string;
  description: string;
  features: string[];
  /** Stripe Price ID (recorrente). Null no Free. */
  priceId: string | null;
  highlighted?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceNote: "+ 30% sobre vendas recuperadas",
    description: "Pague só quando recuperar. Sem mensalidade.",
    priceId: null,
    features: [
      "Sem mensalidade",
      "30% de comissão sobre vendas recuperadas",
      "Checkouts ilimitados",
      "1 fluxo de recuperação",
      "WhatsApp via Loop API",
      "Dashboard básico",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 297,
    description: "Mensalidade fixa, sem comissão.",
    priceId: process.env.STRIPE_PRICE_PRO ?? null,
    highlighted: true,
    features: [
      "0% de comissão sobre vendas",
      "Até 2.000 checkouts/mês",
      "Fluxos e campanhas ilimitados",
      "Templates com variáveis",
      "Receita em R$ e US$",
      "Até 3 membros",
    ],
  },
  {
    id: "escala",
    name: "Escala",
    priceMonthly: 897,
    description: "Para operações em crescimento.",
    priceId: process.env.STRIPE_PRICE_ESCALA ?? null,
    features: [
      "0% de comissão sobre vendas",
      "Até 10.000 checkouts/mês",
      "Tudo do Pro",
      "Membros ilimitados",
      "Relatórios avançados",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 5697,
    description: "Para alto volume, sem limites.",
    priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
    features: [
      "0% de comissão sobre vendas",
      "Checkouts ilimitados",
      "Tudo do Escala",
      "Suporte prioritário dedicado",
      "SLA e onboarding assistido",
    ],
  },
];

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function planByPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return PLANS.find((p) => p.priceId && p.priceId === priceId) ?? null;
}
