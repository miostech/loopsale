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
  /** Se true, o atendimento gerenciado já está incluído no plano. */
  includesSupport?: boolean;
  /** Comissão sobre vendas recuperadas (0..1). Ex: Free 0.4, Pro 0.1. */
  commissionRate: number;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceNote: "+ 40% sobre vendas recuperadas",
    description: "Pague só quando recuperar. Sem mensalidade.",
    priceId: null,
    commissionRate: 0.4,
    features: [
      "Sem mensalidade",
      "40% de comissão sobre vendas recuperadas",
      "Checkouts ilimitados",
      "1 fluxo de recuperação",
      "WhatsApp via Loop API",
      "Dashboard básico",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 897,
    priceNote: "+ 10% sobre vendas recuperadas",
    description: "Mensalidade fixa + 10% sobre recuperadas.",
    priceId: process.env.STRIPE_PRICE_PRO ?? null,
    highlighted: true,
    commissionRate: 0.1,
    features: [
      "10% de comissão sobre vendas recuperadas",
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
    priceMonthly: 5697,
    description: "Para operações em crescimento.",
    priceId: process.env.STRIPE_PRICE_ESCALA ?? null,
    includesSupport: true,
    commissionRate: 0,
    features: [
      "0% de comissão sobre vendas",
      "Até 10.000 checkouts/mês",
      "Atendimento gerenciado incluído",
      "Tudo do Pro",
      "Membros ilimitados",
      "Relatórios avançados",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 12500,
    description: "Para alto volume, sem limites.",
    priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
    includesSupport: true,
    commissionRate: 0,
    features: [
      "0% de comissão sobre vendas",
      "Checkouts ilimitados",
      "Atendimento gerenciado incluído",
      "Tudo do Escala",
      "Suporte prioritário dedicado",
      "SLA e onboarding assistido",
    ],
  },
];

/**
 * Add-on de atendimento gerenciado: mensalidade fixa para o time da LoopSale
 * responder as conversas do WhatsApp e fechar as vendas pelo cliente.
 * Sem o add-on, o próprio cliente atende (incluído em todos os planos).
 */
export const SUPPORT_ADDON = {
  name: "Atendimento gerenciado",
  description:
    "O time da LoopSale responde e fecha as vendas do fluxo de recuperação por você.",
  priceMonthly: 1997,
  priceId: process.env.STRIPE_PRICE_SUPPORT ?? null,
  features: [
    "Atende as respostas do fluxo de recuperação no WhatsApp",
    "Foco em fechar as vendas recuperadas",
    "Relatório de atendimentos",
  ],
  /** Escopo do que NÃO está incluído (deixa claro na UI). */
  scopeNote:
    "Cobre apenas as conversas do fluxo de recuperação. Não inclui suporte ao curso, dúvidas do produto, pós-venda ou atendimento geral ao cliente.",
};

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** Taxa de comissão sobre vendas recuperadas do plano (0 se não cobra). */
export function commissionRateOf(id: string | null | undefined): number {
  return getPlan(id).commissionRate ?? 0;
}

export function planByPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return PLANS.find((p) => p.priceId && p.priceId === priceId) ?? null;
}
