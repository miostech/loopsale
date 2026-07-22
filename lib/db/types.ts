import type { ObjectId } from "mongodb";

/** Documento com _id do MongoDB; ao retornar para API use id (string). */
export type WithId<T> = T & { _id: ObjectId };

export interface AccountSubscription {
  /** id do plano (free/pro/escala). */
  plan: string;
  /** status do Stripe (active, trialing, past_due, canceled, incomplete...). */
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
}

/** Add-on de atendimento gerenciado (assinatura Stripe separada do plano). */
export interface AccountSupport {
  /** true = LoopSale atende; false/ausente = o próprio cliente atende. */
  active: boolean;
  status?: string;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
}

export interface Account {
  _id?: ObjectId;
  name: string;
  slug: string;
  subscription?: AccountSubscription | null;
  support?: AccountSupport | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  _id?: ObjectId;
  accountId: string;
  email: string;
  name: string | null;
  passwordHash: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Integration {
  _id?: ObjectId;
  accountId: string;
  platform: string;
  config: Record<string, unknown>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckoutEvent {
  _id?: ObjectId;
  accountId: string;
  platform: string;
  eventType: string;
  platformCheckoutId?: string | null;
  platformOrderId?: string | null;
  payload: Record<string, unknown>;
  customerEmail?: string | null;
  customerPhone?: string | null;
  productId?: string | null;
  productName?: string | null;
  amount?: string | null;
  /** Moeda do evento (ex: BRL, USD), quando informada. */
  currency?: string | null;
  /** Taxas do evento (na moeda), quando informadas. */
  fees?: string | null;
  affiliate?: string | null;
  createdAt: Date;
}

/** Origem de um checkout recuperável: carrinho abandonado ou pagamento recusado. */
export type RecoveryType = "abandoned" | "refused";

export interface AbandonedCheckout {
  _id?: ObjectId;
  accountId: string;
  checkoutEventId: string;
  platform: string;
  platformCheckoutId: string;
  /**
   * Tipo de recuperação. Documentos antigos não têm este campo e devem ser
   * tratados como "abandoned" (ver metrics.ts, que usa $ifNull).
   */
  recoveryType?: RecoveryType;
  customerEmail?: string | null;
  customerPhone?: string | null;
  productId?: string | null;
  productName?: string | null;
  amount?: string | null;
  /** Moeda do carrinho em risco (ex: BRL, USD). Define o balde do valor em risco. */
  currency?: string | null;
  /** Taxas informadas no evento de abandono (na moeda do carrinho). */
  fees?: string | null;
  affiliate?: string | null;
  recoveredAt?: Date | null;
  /** Valor líquido efetivamente pago quando recuperado (na moeda da venda). */
  recoveredAmount?: string | null;
  /** Moeda da venda que recuperou (ex: BRL, USD). Define o balde no dashboard. */
  recoveredCurrency?: string | null;
  /** Taxas da venda que recuperou. */
  recoveredFees?: string | null;
  createdAt: Date;
}

export interface RecoveryFlow {
  _id?: ObjectId;
  accountId: string;
  name: string;
  productId?: string | null;
  active: boolean;
  abandonmentMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryFlowStep {
  _id?: ObjectId;
  recoveryFlowId: string;
  orderIndex: number;
  delayMinutes: number;
  channel: string;
  templateId?: string | null;
  templateBody?: string | null;
  couponCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledRecoveryMessage {
  _id?: ObjectId;
  abandonedCheckoutId: string;
  recoveryFlowStepId: string;
  runAt: Date;
  sentAt?: Date | null;
  status: string;
  createdAt: Date;
}

export interface Lead {
  _id?: ObjectId;
  accountId: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  source: string;
  status: string;
  tags: string[];
  lastContactedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageTemplate {
  _id?: ObjectId;
  accountId: string;
  channel: string;
  name: string;
  body: string;
  subject?: string | null;
  /** Nome do template aprovado na Meta (WhatsApp Cloud API), ex: "mim1". */
  metaTemplateName?: string | null;
  /** Idioma do template na Meta, ex: "pt_BR". */
  language?: string | null;
  /** Rótulos das variáveis posicionais do template ({{1}}, {{2}}...). */
  variables?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadSegment {
  _id?: ObjectId;
  accountId: string;
  name: string;
  ruleType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  _id?: ObjectId;
  accountId: string;
  name: string;
  type: string;
  segmentId?: string | null;
  /** Template de mensagem que a campanha envia (referencia MessageTemplate). */
  templateId?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignStep {
  _id?: ObjectId;
  campaignId: string;
  orderIndex: number;
  delayMinutes: number;
  channel: string;
  templateBody?: string | null;
  templateId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignVariant {
  _id?: ObjectId;
  campaignId: string;
  name: string;
  splitPercent: number;
  templateBody?: string | null;
  createdAt: Date;
}

export interface ScheduledCampaignMessage {
  _id?: ObjectId;
  campaignId: string;
  leadId: string;
  campaignStepId: string;
  variantId?: string | null;
  runAt: Date;
  sentAt?: Date | null;
  status: string;
  createdAt: Date;
}
