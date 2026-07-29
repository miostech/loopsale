import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin";
import type { Account, NumberRequest, User } from "@/lib/db/types";

type SessionUser = { email?: string | null };

/** Em andamento = ainda exige ação do time da LoopSale. */
export const EM_ANDAMENTO = ["pending", "provisioning"];

async function guard() {
  const session = await getServerSession(authOptions);
  return isSuperAdmin((session?.user as SessionUser | undefined)?.email);
}

/** Pedidos de número gerenciado, com a empresa e quem pediu. */
export async function GET() {
  if (!(await guard())) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ pedidos: [] });
  }

  const reqCol = await getCollection("numberRequests");
  const accountsCol = await getCollection("accounts");
  const usersCol = await getCollection("users");

  const rows = (await reqCol
    .find({})
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray()) as (NumberRequest & { _id: ObjectId })[];

  const pedidos = [];
  for (const r of rows) {
    const oid = await routeObjectId(r.accountId);
    const account = oid
      ? ((await accountsCol.findOne({ _id: oid })) as Account | null)
      : null;
    // Quem solicitou pode não ter ficado gravado (pedido criado pelo webhook).
    const admin = r.requestedBy
      ? null
      : ((await usersCol.findOne({
          accountId: r.accountId,
          role: "admin",
        })) as User | null);

    pedidos.push({
      id: String(r._id),
      accountId: r.accountId,
      empresa: account?.name ?? "(conta não encontrada)",
      contato: r.requestedBy || admin?.email || "—",
      status: r.status,
      deliveredNumber: r.deliveredNumber ?? null,
      addonAtivo: !!account?.numberAddon?.active,
      whatsappConectado: !!account?.whatsapp?.accessToken,
      createdAt: r.createdAt,
    });
  }

  return NextResponse.json({
    pedidos,
    emAndamento: pedidos.filter((p) => EM_ANDAMENTO.includes(p.status)).length,
  });
}

/** Marca o número como entregue, ou cancela o pedido. */
export async function PATCH(request: Request) {
  if (!(await guard())) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const oid = await routeObjectId(String(body.id ?? ""));
  if (!oid) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const reqCol = await getCollection("numberRequests");
  const now = new Date();

  if (body.action === "entregar") {
    const numero = String(body.numero ?? "").trim();
    if (!numero) {
      return NextResponse.json(
        { error: "Informe o número entregue." },
        { status: 400 }
      );
    }
    await reqCol.updateOne(
      { _id: oid as ObjectId },
      { $set: { status: "delivered", deliveredNumber: numero, updatedAt: now } }
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "cancelar") {
    await reqCol.updateOne(
      { _id: oid as ObjectId },
      { $set: { status: "canceled", updatedAt: now } }
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
