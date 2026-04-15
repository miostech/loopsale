import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, mapDocs } from "@/lib/db";
import type { Integration } from "@/lib/db/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const integrationsCol = await getCollection("integrations");
  const list = await integrationsCol
    .find({ accountId: session.user.accountId })
    .project({ platform: 1, active: 1, createdAt: 1 })
    .toArray();
  return NextResponse.json(mapDocs(list));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const platform = String(body.platform ?? "").toLowerCase();
  if (platform !== "kiwify" && platform !== "hotmart") {
    return NextResponse.json(
      { error: "Plataforma inválida. Use kiwify ou hotmart." },
      { status: 400 }
    );
  }

  const crypto = await import("crypto");
  const webhookToken =
    body.webhookToken ?? crypto.randomBytes(24).toString("base64url");

  const now = new Date();
  const doc: Integration = {
    accountId: session.user.accountId,
    platform,
    config: { webhookToken },
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  const integrationsCol = await getCollection("integrations");
  const result = await integrationsCol.insertOne(doc as Integration & { _id?: unknown });
  const inserted = { _id: result.insertedId, ...doc };

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://seusite.com";
  const webhookUrl =
    platform === "kiwify"
      ? `${baseUrl}/api/webhooks/kiwify?token=${webhookToken}`
      : `${baseUrl}/api/webhooks/hotmart?token=${webhookToken}`;

  return NextResponse.json({
    ...mapDoc(inserted),
    webhookUrl,
    message:
      "Configure esta URL no painel da plataforma como URL de webhook. Não compartilhe o token.",
  });
}
