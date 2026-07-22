import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { User } from "@/lib/db/types";

type SessionUser = { accountId?: string; role?: string; email?: string | null };

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (su.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem remover membros." },
      { status: 403 }
    );
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json(
      { error: "Indisponível no modo demo (DATABASE_DISABLED)." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const oid = await routeObjectId(id);
  if (!oid) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const usersCol = await getCollection("users");
  const target = (await usersCol.findOne({
    _id: oid as ObjectId,
    accountId: su.accountId,
  })) as (User & { _id: ObjectId }) | null;
  if (!target) {
    return NextResponse.json(
      { error: "Membro não encontrado." },
      { status: 404 }
    );
  }
  if (target.email === su.email) {
    return NextResponse.json(
      { error: "Você não pode remover a si mesmo." },
      { status: 400 }
    );
  }

  // Não deixar a conta sem nenhum admin.
  if (target.role === "admin") {
    const admins = await usersCol.countDocuments({
      accountId: su.accountId,
      role: "admin",
    });
    if (admins <= 1) {
      return NextResponse.json(
        { error: "A conta precisa ter ao menos um administrador." },
        { status: 400 }
      );
    }
  }

  await usersCol.deleteOne({ _id: oid as ObjectId, accountId: su.accountId });
  return NextResponse.json({ deleted: true });
}
