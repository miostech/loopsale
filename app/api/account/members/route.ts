import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDocs, isDatabaseDisabled } from "@/lib/db";
import { hashPassword } from "@/lib/auth-server";
import type { User } from "@/lib/db/types";

type SessionUser = { accountId?: string; role?: string; email?: string | null };

export async function GET() {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json([
      { id: "demo", name: "Modo demo", email: su.email ?? "", role: "admin" },
    ]);
  }

  const usersCol = await getCollection("users");
  const list = await usersCol
    .find({ accountId: su.accountId })
    .sort({ createdAt: 1 })
    .toArray();
  // Nunca devolver o hash de senha.
  const safe = mapDocs(list).map((u) => ({
    id: u.id,
    name: (u as { name?: string | null }).name ?? null,
    email: (u as { email?: string }).email ?? "",
    role: (u as { role?: string }).role ?? "member",
    isSelf: (u as { email?: string }).email === su.email,
  }));
  return NextResponse.json(safe);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (su.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem adicionar membros." },
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
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const role = body.role === "admin" ? "admin" : "member";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email e senha inicial são obrigatórios." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "A senha inicial deve ter ao menos 6 caracteres." },
      { status: 400 }
    );
  }

  const usersCol = await getCollection("users");
  const existing = await usersCol.findOne({ email });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um usuário com este email." },
      { status: 409 }
    );
  }

  const now = new Date();
  const passwordHash = await hashPassword(password);
  const doc: User = {
    accountId: su.accountId,
    email,
    name: name || null,
    passwordHash,
    role,
    createdAt: now,
    updatedAt: now,
  };
  const result = await usersCol.insertOne(doc as User & { _id?: unknown });
  return NextResponse.json({
    id: String(result.insertedId),
    name: doc.name,
    email: doc.email,
    role: doc.role,
  });
}
