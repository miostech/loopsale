import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import { hashPassword } from "@/lib/auth-server";
import type { User } from "@/lib/db/types";

type SessionUser = { id?: string; email?: string | null; accountId?: string };

export async function POST(request: Request) {
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
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Informe a senha atual e a nova senha." },
      { status: 400 }
    );
  }
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "A nova senha deve ter ao menos 6 caracteres." },
      { status: 400 }
    );
  }

  const usersCol = await getCollection("users");
  const oid = su.id ? await routeObjectId(su.id) : null;
  let user = (oid
    ? await usersCol.findOne({ _id: oid })
    : null) as User & { _id: ObjectId };
  if (!user && su.email) {
    user = (await usersCol.findOne({ email: su.email })) as User & {
      _id: ObjectId;
    };
  }
  if (!user?._id) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 }
    );
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash ?? "");
  if (!ok) {
    return NextResponse.json(
      { error: "Senha atual incorreta." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await usersCol.updateOne(
    { _id: user._id },
    { $set: { passwordHash, updatedAt: new Date() } }
  );
  return NextResponse.json({ ok: true });
}
