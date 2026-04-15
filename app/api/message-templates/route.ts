import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, mapDocs } from "@/lib/db";
import type { MessageTemplate } from "@/lib/db/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const templatesCol = await getCollection("messageTemplates");
  const list = await templatesCol.find({ accountId: session.user.accountId }).toArray();
  return NextResponse.json(mapDocs(list));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const channel = String(body.channel ?? "email").toLowerCase();
  if (!["email", "whatsapp", "sms"].includes(channel)) {
    return NextResponse.json(
      { error: "Canal inválido. Use email, whatsapp ou sms." },
      { status: 400 }
    );
  }
  const name = String(body.name ?? "").trim();
  const bodyText = String(body.body ?? "").trim();
  if (!name || !bodyText) {
    return NextResponse.json(
      { error: "Nome e corpo do template são obrigatórios" },
      { status: 400 }
    );
  }

  const now = new Date();
  const doc: MessageTemplate = {
    accountId: session.user.accountId,
    channel,
    name,
    body: bodyText,
    subject: channel === "email" ? String(body.subject ?? "Recuperação de carrinho").trim() : null,
    createdAt: now,
    updatedAt: now,
  };
  const templatesCol = await getCollection("messageTemplates");
  const result = await templatesCol.insertOne(doc as MessageTemplate & { _id?: unknown });
  const inserted = await templatesCol.findOne({ _id: result.insertedId });
  return NextResponse.json(mapDoc(inserted!));
}
