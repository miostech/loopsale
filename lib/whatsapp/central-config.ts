import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { usesCentralWaba } from "@/lib/whatsapp/cloud";

/**
 * Token da WABA central (o número/WABA da LoopSale, que a LoopSale paga na Meta).
 * Fica guardado no banco (settings) para poder ser renovado pelo admin SEM
 * redeploy — o valor do banco tem prioridade sobre a env WHATSAPP_ACCESS_TOKEN,
 * que fica só como fallback inicial.
 */
const CONFIG_ID = "whatsapp-central";

type CentralDoc = { accessToken?: string; wabaId?: string; updatedAt?: Date };

async function centralDoc(): Promise<CentralDoc | null> {
  if (isDatabaseDisabled()) return null;
  try {
    const col = await getCollection("settings");
    return (await col.findOne({ _id: CONFIG_ID as never })) as CentralDoc | null;
  } catch {
    return null;
  }
}

/** Token central efetivo: banco tem prioridade; env é o fallback. */
export async function getCentralToken(): Promise<string> {
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  const dbToken = (await centralDoc())?.accessToken?.trim();
  return dbToken || envToken;
}

/** WABA ID central efetivo: banco tem prioridade; env é o fallback. */
export async function getCentralWabaId(): Promise<string> {
  const envWaba = process.env.WHATSAPP_WABA_ID ?? "";
  const dbWaba = (await centralDoc())?.wabaId?.trim();
  return dbWaba || envWaba;
}

/** Salva token e/ou WABA ID central no banco (sem redeploy). */
export async function setCentralConfig(params: {
  accessToken?: string;
  wabaId?: string;
}): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  // Token é write-only: só grava se veio um valor (não apaga o atual).
  if (params.accessToken && params.accessToken.trim()) {
    set.accessToken = params.accessToken.trim();
  }
  // WABA ID pode ser definido ou limpo.
  if (params.wabaId !== undefined) {
    set.wabaId = params.wabaId.trim() || null;
  }
  const col = await getCollection("settings");
  await col.updateOne(
    { _id: CONFIG_ID as never },
    { $set: set },
    { upsert: true }
  );
}

/** true se há token central salvo no banco (vs. só a env). */
export async function centralTokenFromDb(): Promise<boolean> {
  if (isDatabaseDisabled()) return false;
  try {
    const col = await getCollection("settings");
    const doc = (await col.findOne({ _id: CONFIG_ID as never })) as CentralDoc | null;
    return !!doc?.accessToken?.trim();
  } catch {
    return false;
  }
}

/**
 * Token para enviar por uma conta: token próprio da conta, senão o token
 * central (banco/env) quando a conta está na WABA central. null = não envia.
 * Substitui tokenFor() nos caminhos de envio, resolvendo o token do banco.
 */
export async function resolveSendToken(
  wa?: { accessToken?: string | null; source?: string | null } | null
): Promise<string | null> {
  if (wa?.accessToken) return wa.accessToken;
  if (usesCentralWaba(wa?.source)) {
    const t = await getCentralToken();
    return t || null;
  }
  return null;
}
