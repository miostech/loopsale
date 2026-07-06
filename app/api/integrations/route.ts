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
  if (platform !== "kiwify" && platform !== "hotmart" && platform !== "n8n") {
    return NextResponse.json(
      { error: "Plataforma inválida. Use kiwify, hotmart ou n8n." },
      { status: 400 }
    );
  }

  const regenerate = body.regenerate === true;
  const integrationsCol = await getCollection("integrations");
  const now = new Date();
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://seusite.com";

  const existing = await integrationsCol.findOne({
    accountId: session.user.accountId,
    platform,
  });

  const crypto = await import("crypto");

  if (existing && !regenerate) {
    const token =
      (existing.config as Record<string, unknown>)?.webhookToken ??
      crypto.randomBytes(24).toString("base64url");
    if (!(existing.config as Record<string, unknown>)?.webhookToken) {
      await integrationsCol.updateOne(
        { _id: existing._id },
        { $set: { "config.webhookToken": token, active: true, updatedAt: now } }
      );
    }
    return NextResponse.json({
      ...mapDoc(existing),
      webhookUrl: `${baseUrl}/api/webhooks/${platform}?token=${token}`,
      message:
        "Integração já existente. Use esta URL como webhook. Não compartilhe o token.",
    });
  }

  const webhookToken =
    body.webhookToken ?? crypto.randomBytes(24).toString("base64url");

  if (existing && regenerate) {
    await integrationsCol.updateOne(
      { _id: existing._id },
      { $set: { "config.webhookToken": webhookToken, active: true, updatedAt: now } }
    );
    const updated = {
      ...existing,
      config: { ...(existing.config as Record<string, unknown>), webhookToken },
      updatedAt: now,
    };
    return NextResponse.json({
      ...mapDoc(updated),
      webhookUrl: `${baseUrl}/api/webhooks/${platform}?token=${webhookToken}`,
      message:
        "Novo token gerado. Atualize a URL do webhook. O token anterior deixou de funcionar.",
    });
  }

  const doc: Integration = {
    accountId: session.user.accountId,
    platform,
    config: { webhookToken },
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  const result = await integrationsCol.insertOne(doc as Integration & { _id?: unknown });
  const inserted = { _id: result.insertedId, ...doc };

  const webhookUrl = `${baseUrl}/api/webhooks/${platform}?token=${webhookToken}`;

  return NextResponse.json({
    ...mapDoc(inserted),
    webhookUrl,
    message:
      "Configure esta URL no painel da plataforma como URL de webhook. Não compartilhe o token.",
  });
}
