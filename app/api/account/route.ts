import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";

type SessionUser = { accountId?: string; role?: string };

export async function GET() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ name: "Conta demo", slug: "demo" });
  }

  const accountsCol = await getCollection("accounts");
  const oid = await routeObjectId(su.accountId);
  const account = oid
    ? ((await accountsCol.findOne({ _id: oid })) as Account | null)
    : null;
  return NextResponse.json({
    name: account?.name ?? "",
    slug: account?.slug ?? "",
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (su.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem alterar a conta." },
      { status: 403 }
    );
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json(
      { error: "Indisponível no modo demo (DATABASE_DISABLED)." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "Nome da conta é obrigatório." },
      { status: 400 }
    );
  }

  const accountsCol = await getCollection("accounts");
  const oid = await routeObjectId(su.accountId);
  if (!oid) {
    return NextResponse.json({ error: "Conta inválida" }, { status: 400 });
  }
  await accountsCol.updateOne(
    { _id: oid as ObjectId },
    { $set: { name, updatedAt: new Date() } }
  );
  return NextResponse.json({ ok: true, name });
}
