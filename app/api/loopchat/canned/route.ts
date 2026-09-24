import { NextResponse } from "next/server";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { CannedResponse } from "@/lib/db/types";
import { chatContext, resolveChatAccount } from "@/lib/loopchat/access";
import { isDemoContext } from "@/lib/loopchat/demo";

/** Normaliza o atalho: minúsculo, sem barra, só letras/números/hífen. */
function normalizarAtalho(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
}

async function col() {
  return getCollection("cannedResponses");
}

/** Lista as respostas rápidas da conta (admin: da empresa dona do número). */
export async function GET(request: Request) {
  const ctx = await chatContext();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ctx.isAdmin && ctx.access !== "available") {
    return NextResponse.json({ respostas: [] });
  }
  if (isDemoContext(ctx) || isDatabaseDisabled()) {
    return NextResponse.json({ respostas: [] });
  }
  const channel = new URL(request.url).searchParams.get("channel") || null;
  const alvo = await resolveChatAccount(ctx, channel);
  const c = await col();
  const rows = (await c
    .find({ accountId: alvo.accountId })
    .sort({ shortcut: 1 })
    .toArray()) as unknown as (CannedResponse & { _id: unknown })[];
  return NextResponse.json({
    respostas: rows.map((r) => ({
      id: String(r._id),
      shortcut: r.shortcut,
      title: r.title ?? null,
      content: r.content,
    })),
  });
}

/** Cria uma resposta rápida. */
export async function POST(request: Request) {
  const ctx = await chatContext();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ctx.isAdmin && ctx.access !== "available") {
    return NextResponse.json({ error: "LoopChat indisponível." }, { status: 402 });
  }
  if (isDemoContext(ctx)) return NextResponse.json({ ok: true });
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const shortcut = normalizarAtalho(body.shortcut);
  const content = String(body.content ?? "").trim();
  const title = String(body.title ?? "").trim();
  if (!shortcut || !content) {
    return NextResponse.json(
      { error: "Informe o atalho e a mensagem." },
      { status: 400 }
    );
  }
  const alvo = await resolveChatAccount(ctx, body.channel ? String(body.channel) : null);
  const c = await col();
  const jaExiste = await c.findOne({ accountId: alvo.accountId, shortcut });
  if (jaExiste) {
    return NextResponse.json(
      { error: `O atalho /${shortcut} já existe.` },
      { status: 409 }
    );
  }
  const now = new Date();
  const res = await c.insertOne({
    accountId: alvo.accountId,
    shortcut,
    title: title || null,
    content,
    createdAt: now,
    updatedAt: now,
  } as CannedResponse);
  return NextResponse.json({
    ok: true,
    id: String(res.insertedId),
    shortcut,
  });
}

/** Edita uma resposta rápida. */
export async function PATCH(request: Request) {
  const ctx = await chatContext();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ctx.isAdmin && ctx.access !== "available") {
    return NextResponse.json({ error: "LoopChat indisponível." }, { status: 402 });
  }
  if (isDemoContext(ctx)) return NextResponse.json({ ok: true });
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const oid = await routeObjectId(String(body.id ?? ""));
  if (!oid) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  const shortcut = normalizarAtalho(body.shortcut);
  const content = String(body.content ?? "").trim();
  const title = String(body.title ?? "").trim();
  if (!shortcut || !content) {
    return NextResponse.json(
      { error: "Informe o atalho e a mensagem." },
      { status: 400 }
    );
  }
  const alvo = await resolveChatAccount(ctx, body.channel ? String(body.channel) : null);
  const c = await col();
  // Atalho não pode colidir com outra resposta da conta.
  const colisao = await c.findOne({
    accountId: alvo.accountId,
    shortcut,
    _id: { $ne: oid },
  });
  if (colisao) {
    return NextResponse.json(
      { error: `O atalho /${shortcut} já existe.` },
      { status: 409 }
    );
  }
  await c.updateOne(
    { _id: oid, accountId: alvo.accountId },
    { $set: { shortcut, title: title || null, content, updatedAt: new Date() } }
  );
  return NextResponse.json({ ok: true });
}

/** Exclui uma resposta rápida. */
export async function DELETE(request: Request) {
  const ctx = await chatContext();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ctx.isAdmin && ctx.access !== "available") {
    return NextResponse.json({ error: "LoopChat indisponível." }, { status: 402 });
  }
  if (isDemoContext(ctx)) return NextResponse.json({ ok: true });
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const oid = await routeObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  const alvo = await resolveChatAccount(ctx, url.searchParams.get("channel") || null);
  const c = await col();
  await c.deleteOne({ _id: oid, accountId: alvo.accountId });
  return NextResponse.json({ ok: true });
}
