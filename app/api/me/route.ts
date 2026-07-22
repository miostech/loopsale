import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";

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
      account: { name: "Conta demo", slug: "demo" },
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
    role: user?.role ?? su.role ?? "member",
    account: account
      ? { name: account.name, slug: account.slug }
      : { name: "", slug: "" },
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

  const user = await findCurrentUser(su);
  if (!user?._id) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 }
    );
  }

  const usersCol = await getCollection("users");
  await usersCol.updateOne(
    { _id: user._id as ObjectId },
    { $set: { name, updatedAt: new Date() } }
  );
  return NextResponse.json({ ok: true, name });
}
