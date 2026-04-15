import type { ObjectId } from "mongodb";

/** Documento com _id do MongoDB; ao retornar para API use id (string). */
export type WithId<T> = T & { _id: ObjectId };

export interface Account {
  _id?: ObjectId;
  name: string;
  slug: string;
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
  createdAt: Date;
}

export interface AbandonedCheckout {
  _id?: ObjectId;
  accountId: string;
  checkoutEventId: string;
  platform: string;
  platformCheckoutId: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  productId?: string | null;
  productName?: string | null;
  amount?: string | null;
  recoveredAt?: Date | null;
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
