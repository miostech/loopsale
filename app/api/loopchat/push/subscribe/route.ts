import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { chatContext } from "@/lib/loopchat/access";

/** Salva a inscrição de push do navegador para receber notificações do LoopChat. */
export async function POST(request: Request) {
  const ctx = await chatContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (ctx.access !== "available") {
    return NextResponse.json(
      { error: "LoopChat indisponível." },
      { status: ctx.access === "hidden" ? 403 : 402 }
    );
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ ok: true });
  }

  const body = await request.json().catch(() => ({}));
  const sub = body.subscription;
  const endpoint = sub?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  }

  const col = await getCollection("pushSubscriptions");
  await col.updateOne(
    { endpoint },
    {
      $set: {
        accountId: ctx.accountId,
        userId: ctx.userId,
        endpoint,
        subscription: sub,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
