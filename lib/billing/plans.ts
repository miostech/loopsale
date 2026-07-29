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
  /**
   * Conversas do LoopChat incluídas grátis por mês (contatos ativos no mês).
   * 0 = nunca grátis (precisa contratar o add-on). null = ilimitado.
   * Passando da cota, a conta precisa contratar o LoopChat.
   */
  chatFreeConversations: number | null;
  /** Máximo de membros (usuários) da conta. null = ilimitado. */
  maxMembers: number | null;
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
    chatFreeConversations: 0,
    maxMembers: 1,
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
    chatFreeConversations: 500,
    maxMembers: 3,
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
    chatFreeConversations: 3000,
    maxMembers: null,
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
    chatFreeConversations: null,
    maxMembers: null,
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

/**
 * Add-on de número gerenciado: a LoopSale fornece e mantém a linha, mas ela é
 * registrada na WABA do próprio cliente — o custo das mensagens da Meta segue
 * sendo dele. Cobra taxa de ativação (única) + mensalidade (manutenção).
 *
 * VALORES PROVISÓRIOS: confirmar antes de abrir para clientes.
 */
export const NUMBER_ADDON = {
  name: "Número WhatsApp gerenciado",
  description:
    "A LoopSale fornece a linha, ativa na Meta e mantém o número usado nas suas recuperações.",
  /** Taxa única de ativação (aquisição da linha, verificação, configuração). */
  activationFee: Number(process.env.NUMBER_ADDON_ACTIVATION_BRL) || 199,
  /** Mensalidade de manutenção da linha. */
  priceMonthly: Number(process.env.NUMBER_ADDON_MONTHLY_BRL) || 49.9,
  priceIdActivation: process.env.STRIPE_PRICE_NUMBER_ACTIVATION ?? null,
  priceIdMonthly: process.env.STRIPE_PRICE_NUMBER_MONTHLY ?? null,
  features: [
    "Linha exclusiva fornecida pela LoopSale",
    "Ativação e verificação na Meta",
    "Registrado na sua conta do WhatsApp Business",
    "Manutenção e suporte em caso de bloqueio ou troca",
  ],
  /** Deixa explícito o que NÃO está incluído, para não virar reclamação. */
  scopeNote:
    "As mensagens da Meta continuam sendo pagas por você, no cartão da sua conta. O número é disponibilizado enquanto o add-on estiver ativo.",
};

/**
 * LoopChat: caixa de entrada do número conectado, para o cliente (ou o time
 * dele) responder as conversas. Não faz sentido para quem contratou o
 * atendimento gerenciado — nesse caso quem responde é a LoopSale.
 *
 * VALOR PROVISÓRIO: confirmar antes de criar o preço no Stripe.
 */
export const CHAT_ADDON = {
  name: "LoopChat",
  description:
    "Caixa de entrada do seu número: veja e responda as conversas dos clientes direto na LoopSale.",
  priceMonthly: Number(process.env.LOOPCHAT_MONTHLY_BRL) || 97,
  priceId: process.env.STRIPE_PRICE_LOOPCHAT ?? null,
  features: [
    "Conversas do seu número em um só lugar",
    "Responda você ou sua equipe",
    "Histórico ligado ao checkout recuperado",
  ],
};

/** O que a conta pode fazer no LoopChat. */
export type LoopChatAccess = "hidden" | "available" | "locked";

/** Conversas grátis/mês do plano (contatos ativos). null = ilimitado. */
export function chatFreeConversationsOf(
  planId: string | null | undefined
): number | null {
  return getPlan(planId).chatFreeConversations;
}

/** Máximo de membros do plano. null = ilimitado. */
export function maxMembersOf(planId: string | null | undefined): number | null {
  return getPlan(planId).maxMembers;
}

/**
 * Regra única de acesso ao LoopChat — usada pelo menu, pela página e pela API.
 * "hidden": tem atendimento gerenciado, quem responde é a LoopSale.
 * "available": pode usar (add-on contratado, plano com cota ainda dentro do
 *   limite, ou plano ilimitado).
 * "locked": precisa contratar — Free (sem cota grátis) ou cota do mês estourada.
 *
 * Ordem: atendimento gerenciado > add-on contratado > cota do plano.
 */
export function loopChatAccess(params: {
  supportActive?: boolean | null;
  chatActive?: boolean | null;
  planId?: string | null;
  /** Contatos ativos no mês corrente (conta pra cota grátis do plano). */
  monthlyConversations?: number | null;
}): LoopChatAccess {
  if (params.supportActive) return "hidden";
  // Contratou o add-on: chat liberado sem limite de conversas.
  if (params.chatActive) return "available";
  const cota = chatFreeConversationsOf(params.planId);
  if (cota === null) return "available"; // plano ilimitado (Enterprise)
  // Free (cota 0) nunca é grátis; nos demais, vale até bater a cota do mês.
  if (cota > 0 && (params.monthlyConversations ?? 0) <= cota) return "available";
  return "locked";
}

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/**
 * Receita de assinatura mensal (R$) que a LoopSale cobra do cliente: mensalidade
 * do plano + atendimento gerenciado (se contratado e não já incluído no plano).
 * Não inclui comissão (que é variável, sobre vendas recuperadas).
 */
export function subscriptionRevenueOf(
  planId: string | null | undefined,
  supportActive: boolean
): number {
  const plan = getPlan(planId);
  let mensal = plan.priceMonthly;
  if (supportActive && !plan.includesSupport) mensal += SUPPORT_ADDON.priceMonthly;
  return mensal;
}

/** Taxa de comissão sobre vendas recuperadas do plano (0 se não cobra). */
export function commissionRateOf(id: string | null | undefined): number {
  return getPlan(id).commissionRate ?? 0;
}

export function planByPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return PLANS.find((p) => p.priceId && p.priceId === priceId) ?? null;
}
