import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { usesCentralWaba } from "@/lib/whatsapp/cloud";

/**
 * Token da WABA central (o número/WABA da LoopSale, que a LoopSale paga na Meta).
 * Fica guardado no banco (settings) para poder ser renovado pelo admin SEM
 * redeploy — o valor do banco tem prioridade sobre a env WHATSAPP_ACCESS_TOKEN,
 * que fica só como fallback inicial.
 */
const CONFIG_ID = "whatsapp-central";

type CentralDoc = { accessToken?: string; updatedAt?: Date };

/** Token central efetivo: banco tem prioridade; env é o fallback. */
export async function getCentralToken(): Promise<string> {
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  if (isDatabaseDisabled()) return envToken;
  try {
    const col = await getCollection("settings");
    const doc = (await col.findOne({ _id: CONFIG_ID as never })) as CentralDoc | null;
    const dbToken = doc?.accessToken?.trim();
    return dbToken || envToken;
  } catch {
    return envToken;
  }
}

/** Salva/atualiza o token central no banco (renovação sem redeploy). */
export async function setCentralToken(token: string): Promise<void> {
  const col = await getCollection("settings");
  await col.updateOne(
    { _id: CONFIG_ID as never },
    { $set: { accessToken: token.trim(), updatedAt: new Date() } },
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
