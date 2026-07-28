import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/whatsapp/cloud";
import type { WhatsAppMessage } from "@/lib/db/types";

/**
 * Webhook do WhatsApp Cloud API (Meta).
 * GET  = verificação do endpoint (hub.challenge).
 * POST = status de entrega (sent/delivered/read/failed) e mensagens recebidas.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type WaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: { title?: string; message?: string }[];
};
type WaMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  timestamp?: string;
};
type WaValue = {
  metadata?: { phone_number_id?: string };
  statuses?: WaStatus[];
  messages?: WaMessage[];
};

export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(raw, sig)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }
  // Sempre responde 200 rápido pra Meta não reenviar.
  if (isDatabaseDisabled()) return NextResponse.json({ received: true });

  let payload: {
    entry?: { changes?: { value?: WaValue }[] }[];
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ received: true });
  }

  try {
    const accountsCol = await getCollection("accounts");
    const waCol = await getCollection("whatsappMessages");
    const eventsCol = await getCollection("checkoutEvents");
    const now = new Date();

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;
        const phoneNumberId = value.metadata?.phone_number_id ?? null;

        // Resolve a conta dona deste número.
        const account = phoneNumberId
          ? await accountsCol.findOne({
              "whatsapp.phoneNumberId": phoneNumberId,
            })
          : null;
        const accountId = account?._id ? String(account._id) : null;

        // 1) Status de entrega (mensagens que a LoopSale enviou).
        for (const st of value.statuses ?? []) {
          if (!st.id) continue;
          const status = st.status ?? null;
          const err = st.errors?.[0]?.message ?? null;
          await waCol.updateOne(
            { wamid: st.id },
            {
              $set: {
                status,
                ...(err ? { error: err } : {}),
                updatedAt: now,
              },
            }
          );
          // Reflete no histórico do checkout (campo já existente).
          await eventsCol.updateMany(
            { whatsappMessageId: st.id },
            { $set: { whatsappStatus: status, updatedAt: now } }
          );
        }

        // 2) Mensagens recebidas (respostas do cliente final).
        for (const msg of value.messages ?? []) {
          if (!msg.id) continue;
          const doc: WhatsAppMessage = {
            accountId: accountId ?? "",
            direction: "in",
            wamid: msg.id,
            phoneNumberId,
            contact: msg.from ?? null,
            type: msg.type ?? "text",
            body: msg.text?.body ?? null,
            status: "received",
            createdAt: now,
            updatedAt: now,
          };
          // Idempotência por wamid.
          await waCol.updateOne(
            { wamid: msg.id },
            { $setOnInsert: doc },
            { upsert: true }
          );
        }
      }
    }
  } catch (e) {
    console.error("whatsapp webhook:", e);
  }

  return NextResponse.json({ received: true });
}
