import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { getPlan, maxMembersOf } from "@/lib/billing/plans";

type SessionUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
  accountId?: string;
  role?: string;
};

async function findCurrentUser(su: SessionUser) {
  const usersCol = await getCollection("users");
  const oid = su.id ? await routeObjectId(su.id) : null;
  let user = oid ? await usersCol.findOne({ _id: oid }) : null;
  if (!user && su.email) user = await usersCol.findOne({ email: su.email });
  return user;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (isDatabaseDisabled()) {
    return NextResponse.json({
      name: su.name ?? "Modo demo",
      email: su.email ?? "",
      role: su.role ?? "admin",
      account: { name: "Conta demo", slug: "demo", plano: "free", maxMembers: null },
      demo: true,
    });
  }

  const user = await findCurrentUser(su);
  const accountsCol = await getCollection("accounts");
  const accOid = await routeObjectId(su.accountId);
  const account = accOid
    ? ((await accountsCol.findOne({ _id: accOid })) as Account | null)
    : null;

  return NextResponse.json({
    name: user?.name ?? su.name ?? null,
    email: user?.email ?? su.email ?? "",
    phone: (user as { phone?: string | null } | null)?.phone ?? null,
    role: user?.role ?? su.role ?? "member",
    account: account
      ? {
          name: account.name,
          slug: account.slug,
          plano: getPlan(account.subscription?.plan).id,
          maxMembers: maxMembersOf(account.subscription?.plan),
        }
      : { name: "", slug: "", plano: "free", maxMembers: maxMembersOf("free") },
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json(
      { error: "Indisponível no modo demo (DATABASE_DISABLED)." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (name === null) {
    return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
  }
  // Telefone é opcional; o email NÃO pode ser alterado por aqui (só suporte).
  const phone =
    typeof body.phone === "string" ? body.phone.trim() : undefined;

  const user = await findCurrentUser(su);
  if (!user?._id) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 }
    );
  }

  const set: Record<string, unknown> = { name, updatedAt: new Date() };
  if (phone !== undefined) set.phone = phone;

  const usersCol = await getCollection("users");
  await usersCol.updateOne({ _id: user._id as ObjectId }, { $set: set });
  return NextResponse.json({ ok: true, name, phone: phone ?? user.phone ?? null });
}
