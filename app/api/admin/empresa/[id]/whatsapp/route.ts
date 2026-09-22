import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin";
import type { Account, WhatsAppChannel } from "@/lib/db/types";

type SessionUser = { email?: string | null };

type ChannelInput = {
  name?: unknown;
  source?: unknown;
  phoneNumberId?: unknown;
  displayNumber?: unknown;
  wabaId?: unknown;
  accessToken?: unknown;
};

/**
 * Monta os canais a salvar a partir do que veio da tela, preservando o token
 * de cada canal quando o campo veio em branco (write-only, casado por número).
 */
function montarCanais(
  entrada: ChannelInput[],
  existentes: WhatsAppChannel[]
): WhatsAppChannel[] {
  const tokenPorNumero = new Map(
    existentes.map((c) => [c.phoneNumberId, c.accessToken ?? null])
  );
  const canais: WhatsAppChannel[] = [];
  for (const c of entrada) {
    const phoneNumberId = String(c.phoneNumberId ?? "").trim();
    if (!phoneNumberId) continue; // sem número não roteia
    const own = c.source === "own";
    const nome = String(c.name ?? "").trim() || "WhatsApp";
    const displayNumber = String(c.displayNumber ?? "").trim();
    const wabaId = String(c.wabaId ?? "").trim();
    const novoToken = String(c.accessToken ?? "").trim();
    const token = own
      ? novoToken || tokenPorNumero.get(phoneNumberId) || null
      : null;
    canais.push({
      name: nome,
      source: own ? "own" : "central",
      phoneNumberId,
      displayNumber: displayNumber || null,
      wabaId: own ? wabaId || null : null,
      accessToken: token,
      connectedAt: new Date(),
    });
  }
  return canais;
}

/** Define o Phone Number ID (WABA central) do cliente. Só super-admin. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível" }, { status: 503 });
  }

  const { id } = await params;
  const oid = await routeObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const accountsCol = await getCollection("accounts");

  // Multi-canal: quando vem uma lista `channels`, ela é a fonte da verdade.
  if (Array.isArray(body.channels)) {
    const atual = (await accountsCol.findOne({ _id: oid })) as Account | null;
    const canais = montarCanais(
      body.channels as ChannelInput[],
      atual?.channels ?? []
    );
    await accountsCol.updateOne(
      { _id: oid },
      { $set: { channels: canais, updatedAt: new Date() } }
    );
    return NextResponse.json({ ok: true, channels: canais.length });
  }

  const own = body.source === "own";
  const phoneNumberId =
    typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
  const displayNumber =
    typeof body.displayNumber === "string" ? body.displayNumber.trim() : "";
  const wabaId = typeof body.wabaId === "string" ? body.wabaId.trim() : "";
  const accessToken =
    typeof body.accessToken === "string" ? body.accessToken.trim() : "";

  // "own" = WABA própria do cliente (token/WABA dele). "central" = número na
  // WABA da LoopSale (usa o token central). O envio resolve o token por aqui.
  const set: Record<string, unknown> = {
    "whatsapp.source": own ? "own" : "central",
    "whatsapp.phoneNumberId": phoneNumberId || null,
    "whatsapp.displayNumber": displayNumber || null,
    "whatsapp.wabaId": own ? wabaId || null : null,
    "whatsapp.connectedAt": phoneNumberId ? new Date() : null,
    updatedAt: new Date(),
  };
  if (own) {
    // Token é write-only: só troca se veio um valor novo (não apaga o atual).
    if (accessToken) set["whatsapp.accessToken"] = accessToken;
  } else {
    // Central: não usa token próprio.
    set["whatsapp.accessToken"] = null;
  }

  await accountsCol.updateOne({ _id: oid }, { $set: set });
  return NextResponse.json({ ok: true });
}
