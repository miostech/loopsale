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
    const { name, email, password, empresa, platform, phone } = body;
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 }
      );
    }
    if (!empresa || !String(empresa).trim()) {
      return NextResponse.json(
        { error: "Informe o nome da empresa." },
        { status: 400 }
      );
    }
    if (!phone || !String(phone).trim()) {
      return NextResponse.json(
        { error: "Informe o telefone/WhatsApp de contato." },
        { status: 400 }
      );
    }
    if (platform !== "kiwify" && platform !== "hotmart") {
      return NextResponse.json(
        { error: "Escolha a plataforma (Kiwify ou Hotmart)." },
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
      name: String(empresa).trim(),
      slug: slug + "-" + Date.now(),
      platform,
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
      phone: String(phone).trim(),
      passwordHash,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    };
    await usersCol.insertOne(userDoc as User & { _id?: unknown });
    return NextResponse.json({ ok: true, redirect: "/dashboard" });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Erro ao cadastrar. Tente outro email." },
      { status: 500 }
    );
  }
}
