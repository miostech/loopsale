import { connectDb, getDb } from "./mongo";
import { isDatabaseDisabled } from "./config";
import { createMockCollection } from "./mock-collection";

export { connectDb, getDb } from "./mongo";
export { isDatabaseDisabled } from "./config";
export { routeObjectId } from "./route-object-id";
export * from "./types";

const COLLECTIONS = {
  accounts: "accounts",
  users: "users",
  integrations: "integrations",
  checkoutEvents: "checkout_events",
  abandonedCheckouts: "abandoned_checkouts",
  recoveryFlows: "recovery_flows",
  recoveryFlowSteps: "recovery_flow_steps",
  scheduledRecoveryMessages: "scheduled_recovery_messages",
  leads: "leads",
  messageTemplates: "message_templates",
  leadSegments: "lead_segments",
  campaigns: "campaigns",
  campaignSteps: "campaign_steps",
  campaignVariants: "campaign_variants",
  scheduledCampaignMessages: "scheduled_campaign_messages",
  products: "products",
} as const;

/** Converte documento MongoDB para formato da API: id (string) em vez de _id. */
export function mapDoc<T extends { _id?: unknown }>(doc: T | null): (Omit<T, "_id"> & { id: string }) | null {
  if (!doc) return null;
  const { _id, ...rest } = doc as T & { _id?: unknown };
  const id =
    _id != null && typeof _id === "object" && "toString" in _id
      ? String((_id as { toString: () => string }).toString())
      : String(_id);
  return { ...rest, id } as Omit<T, "_id"> & { id: string };
}

/** Converte array de documentos. */
export function mapDocs<T extends { _id?: unknown }>(docs: T[]): (Omit<T, "_id"> & { id: string })[] {
  return docs.map((d) => mapDoc(d)!).filter(Boolean);
}

export async function getCollection(name: keyof typeof COLLECTIONS) {
  if (isDatabaseDisabled()) {
    return createMockCollection(COLLECTIONS[name]);
  }
  const db = await getDb();
  return db.collection(COLLECTIONS[name]);
}

export { COLLECTIONS };
