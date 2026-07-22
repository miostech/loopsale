/**
 * Planos da LoopSale. Os priceId vêm do Stripe (env) — cada plano pago mapeia
 * um Price recorrente criado no painel do Stripe. Ajuste preços/limites à
 * vontade; a UI e o checkout leem daqui.
 */
export type Plan = {
  id: string;
  name: string;
  /** Preço mensal em BRL (0 = grátis). Apenas exibição. */
  priceMonthly: number;
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
    description: "Para começar a recuperar vendas.",
    priceId: null,
    features: [
      "Até 100 checkouts/mês",
      "1 fluxo de recuperação",
      "WhatsApp via Loop API",
      "Dashboard básico",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 97,
    description: "Para escalar a recuperação.",
    priceId: process.env.STRIPE_PRICE_PRO ?? null,
    highlighted: true,
    features: [
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
    priceMonthly: 297,
    description: "Para operações de alto volume.",
    priceId: process.env.STRIPE_PRICE_ESCALA ?? null,
    features: [
      "Checkouts ilimitados",
      "Tudo do Pro",
      "Membros ilimitados",
      "Relatórios avançados",
      "Suporte prioritário",
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
