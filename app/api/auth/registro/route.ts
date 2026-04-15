import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { hashPassword } from "@/lib/auth-server";
import type { Account, User } from "@/lib/db/types";

export async function POST(request: Request) {
  try {
    if (isDatabaseDisabled()) {
      return NextResponse.json(
        {
          error:
            "Cadastro indisponível enquanto DATABASE_DISABLED estiver ativo. Use o login demo ou configure o MongoDB.",
        },
        { status: 503 }
      );
    }
    const body = await request.json();
    const { name, email, password } = body;
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 }
      );
    }
    const usersCol = await getCollection("users");
    const existing = await usersCol.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "Este email já está cadastrado." },
        { status: 409 }
      );
    }
    const slug = email.split("@")[0].toLowerCase().replace(/\W/g, "-");
    const accountsCol = await getCollection("accounts");
    const now = new Date();
    const accountDoc: Account = {
      name: name || "Minha Conta",
      slug: slug + "-" + Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    const accountResult = await accountsCol.insertOne(accountDoc as Account & { _id?: unknown });
    const accountId = accountResult.insertedId.toString();
    const passwordHash = await hashPassword(password);
    const userDoc: User = {
      accountId,
      email,
      name: name || null,
      passwordHash,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    };
    await usersCol.insertOne(userDoc as User & { _id?: unknown });
    return NextResponse.json({ ok: true, redirect: "/login" });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Erro ao cadastrar. Tente outro email." },
      { status: 500 }
    );
  }
}
