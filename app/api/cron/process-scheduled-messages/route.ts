import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getCollection, routeObjectId } from "@/lib/db";
import { sendMessage } from "@/lib/channels/send";
import {
  tokenFor,
  sendTemplate,
  sendText,
  SEM_TOKEN,
  type SendResult,
} from "@/lib/whatsapp/cloud";
import type { Account, WhatsAppMessage } from "@/lib/db/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scheduledCol = await getCollection("scheduledRecoveryMessages");
  const abandonedCol = await getCollection("abandonedCheckouts");
  const stepsCol = await getCollection("recoveryFlowSteps");

  const now = new Date();
  const pending = await scheduledCol
    .find({ status: "pending", runAt: { $lte: now } })
    .limit(50)
    .toArray();

  let sent = 0;
  for (const row of pending) {
    const abandonedOid = await routeObjectId(String(row.abandonedCheckoutId));
    const stepOid = await routeObjectId(String(row.recoveryFlowStepId));
    const abandoned = abandonedOid
      ? await abandonedCol.findOne({ _id: abandonedOid })
      : null;
    const step = stepOid ? await stepsCol.findOne({ _id: stepOid }) : null;

    if (!abandoned || !step) {
      await scheduledCol.updateOne(
        { _id: row._id as ObjectId },
        { $set: { status: "failed", sentAt: now } }
      );
      continue;
    }

    const to =
      step.channel === "email"
        ? abandoned.customerEmail
        : abandoned.customerPhone;
    if (!to) {
      await scheduledCol.updateOne(
        { _id: row._id as ObjectId },
        { $set: { status: "failed", sentAt: now } }
      );
      continue;
    }

    const body = (step.templateBody ?? "").replace(
      /\{\{checkout_link\}\}/g,
      "[link]"
    );

    let result: SendResult;
    let wamid: string | null = null;

    // WhatsApp via Cloud API: token da WABA do próprio cliente (Embedded
    // Signup). A WABA central só entra para conta legada marcada "central".
    const accountsCol = await getCollection("accounts");
    const accOid = await routeObjectId(String(abandoned.accountId));
    const account = accOid
      ? ((await accountsCol.findOne({ _id: accOid })) as Account | null)
      : null;
    const waToken = tokenFor(
      account?.whatsapp?.accessToken,
      account?.whatsapp?.source
    );

    // Passo de WhatsApp sem token não cai em outro canal: falha dizendo o
    // porquê, senão o cliente fica achando que a recuperação está rodando.
    if (step.channel === "whatsapp" && !waToken) {
      await scheduledCol.updateOne(
        { _id: row._id as ObjectId },
        { $set: { status: "failed", failReason: SEM_TOKEN, sentAt: now } }
      );
      continue;
    }

    if (step.channel === "whatsapp") {
      const phoneNumberId = account?.whatsapp?.phoneNumberId ?? "";

      const metaTemplate = (step as { metaTemplateName?: string })
        .metaTemplateName;
      const language = (step as { language?: string }).language ?? "pt_BR";

      result = metaTemplate
        ? await sendTemplate({
            phoneNumberId,
            to: String(to),
            templateName: metaTemplate,
            language,
            variables: [abandoned.customerName ?? "", "[link]"],
            token: waToken,
          })
        : await sendText({
            phoneNumberId,
            to: String(to),
            body,
            token: waToken,
          });
      wamid = result.wamid ?? null;

      // Registra a mensagem no histórico de conversas.
      const waCol = await getCollection("whatsappMessages");
      const waDoc: WhatsAppMessage = {
        accountId: String(abandoned.accountId),
        direction: "out",
        wamid,
        phoneNumberId,
        contact: String(to),
        type: metaTemplate ? "template" : "text",
        body,
        templateName: metaTemplate ?? null,
        status: result.success ? "accepted" : "failed",
        error: result.error ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await waCol.insertOne(waDoc as WhatsAppMessage & { _id?: unknown });
    } else {
      result = await sendMessage({
        channel: step.channel as "email" | "whatsapp" | "sms",
        to,
        body,
        variables: {
          checkout_link: "[link]",
          customer_name: abandoned.customerEmail ?? "",
        },
      });
    }

    await scheduledCol.updateOne(
      { _id: row._id as ObjectId },
      {
        $set: {
          status: result.success ? "sent" : "failed",
          sentAt: now,
          ...(result.success ? {} : { failReason: result.error ?? "Erro no envio." }),
          ...(wamid ? { whatsappMessageId: wamid } : {}),
        },
      }
    );

    if (result.success) sent++;
  }

  return NextResponse.json({ ok: true, processed: pending.length, sent });
}

export async function POST(request: Request) {
  return GET(request);
}
