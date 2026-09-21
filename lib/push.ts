import webpush from "web-push";
import { getCollection, isDatabaseDisabled } from "@/lib/db";

/**
 * Envio de notificações push (Web Push) para o LoopChat. As inscrições ficam
 * por conta; ao receber uma mensagem nova, notifica quem instalou o app.
 */

let configurado = false;
function configurar(): boolean {
  if (configurado) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@loopsale.com.br",
    pub,
    priv
  );
  configurado = true;
  return true;
}

export function pushConfigurado(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Envia um push para todas as inscrições da conta. Remove as que expiraram. */
export async function enviarPush(
  accountId: string,
  payload: PushPayload
): Promise<void> {
  if (isDatabaseDisabled() || !configurar()) return;
  const col = await getCollection("pushSubscriptions");
  const subs = (await col.find({ accountId }).toArray()) as {
    _id: unknown;
    subscription: webpush.PushSubscription;
  }[];
  if (!subs.length) return;

  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, data);
      } catch (e) {
        // 404/410 = inscrição morta (app desinstalado): apaga.
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await col.deleteOne({ _id: s._id as never });
        }
      }
    })
  );
}
