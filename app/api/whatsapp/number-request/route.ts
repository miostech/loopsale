import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, isDatabaseDisabled, mapDocs } from "@/lib/db";
import type { NumberRequest } from "@/lib/db/types";

type SessionUser = {
  accountId?: string;
  role?: string;
  email?: string | null;
};

/** Estados em que o pedido ainda está em andamento (não cabe abrir outro). */
const EM_ANDAMENTO = ["pending", "provisioning"];

/** Pedido de número gerenciado em aberto desta conta, se houver. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ request: null });
  }

  // Inclui "delivered": o cliente precisa ver o número que recebeu, não só
  // saber que o pedido está em andamento.
  const col = await getCollection("numberRequests");
  const rows = await col
    .find({
      accountId: su.accountId,
      status: { $in: [...EM_ANDAMENTO, "delivered"] },
    })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  const [request] = mapDocs(rows as (NumberRequest & { _id: unknown })[]);
  return NextResponse.json({ request: request ?? null });
}

/** Abre o pedido. O time da LoopSale provisiona a linha e entrega o número. */
export async function POST() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  // Mesma regra do checkout: é contratação, então só admin da conta.
  if (su.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem solicitar um número." },
      { status: 403 }
    );
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json(
      { error: "Indisponível no modo demo." },
      { status: 503 }
    );
  }

  const col = await getCollection("numberRequests");
  const existing = await col.findOne({
    accountId: su.accountId,
    status: { $in: EM_ANDAMENTO },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um pedido de número em andamento para esta conta." },
      { status: 409 }
    );
  }

  const now = new Date();
  const doc: NumberRequest = {
    accountId: su.accountId,
    requestedBy: su.email ?? "",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(doc as NumberRequest & { _id?: unknown });
  return NextResponse.json({ ok: true, status: "pending" });
}
