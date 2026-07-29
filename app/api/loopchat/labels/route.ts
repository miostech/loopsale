import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { Conversation } from "@/lib/db/types";
import { chatContext } from "@/lib/loopchat/access";
import { isDemoContext } from "@/lib/loopchat/demo";

/**
 * Apaga uma etiqueta da conta inteira: tira o rótulo de todas as conversas que
 * o tinham. Como etiqueta não é entidade própria, sumir de todas = deixar de
 * existir (some da barra lateral).
 */
export async function DELETE(request: Request) {
  const ctx = await chatContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (ctx.access !== "available") {
    return NextResponse.json(
      { error: "LoopChat indisponível para esta conta." },
      { status: ctx.access === "hidden" ? 403 : 402 }
    );
  }
  if (isDemoContext(ctx)) return NextResponse.json({ ok: true, removidas: 0 });
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível no modo demo." }, { status: 503 });
  }

  const nome = String(new URL(request.url).searchParams.get("nome") ?? "")
    .trim()
    .toLowerCase();
  if (!nome) {
    return NextResponse.json({ error: "Informe a etiqueta." }, { status: 400 });
  }

  const convCol = (await getCollection(
    "conversations"
  )) as unknown as Collection<Conversation>;
  const res = await convCol.updateMany(
    { accountId: ctx.accountId, labels: nome },
    { $pull: { labels: nome }, $set: { updatedAt: new Date() } }
  );
  return NextResponse.json({ ok: true, removidas: res.modifiedCount });
}
