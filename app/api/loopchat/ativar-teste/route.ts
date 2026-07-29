import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";

type SessionUser = { accountId?: string; role?: string };

/**
 * TEMPORÁRIO — libera o LoopChat sem pagar, para testar a área de mensagens.
 *
 * Remover quando o preço do LoopChat existir no Stripe: aí o botão volta a
 * abrir o checkout. Marca status "teste-manual" justamente para dar para achar
 * (e limpar) as contas liberadas por aqui.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (su.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem ativar." },
      { status: 403 }
    );
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível no modo demo." }, { status: 503 });
  }

  const oid = await routeObjectId(su.accountId);
  if (!oid) {
    return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  }
  const accountsCol = await getCollection("accounts");
  await accountsCol.updateOne(
    { _id: oid as ObjectId },
    {
      $set: {
        "chatAddon.active": true,
        "chatAddon.status": "teste-manual",
        updatedAt: new Date(),
      },
    }
  );
  return NextResponse.json({ ok: true });
}
