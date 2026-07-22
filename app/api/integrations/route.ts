import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection } from "@/lib/db";
import type { Integration } from "@/lib/db/types";

type Platform = "kiwify" | "hotmart" | "n8n";

/** Campos de credencial aceitos por plataforma. `secret` mascara na leitura. */
const CRED_FIELDS: Record<Platform, { key: string; secret: boolean }[]> = {
  kiwify: [
    { key: "accountId", secret: false },
    { key: "clientId", secret: false },
    { key: "clientSecret", secret: true },
  ],
  hotmart: [
    { key: "clientId", secret: false },
    { key: "clientSecret", secret: true },
    { key: "hottok", secret: true },
  ],
  n8n: [],
};

function baseUrl(): string {
  // URL pública do webhook (nunca localhost, mesmo em dev). Configurável via
  // PUBLIC_WEBHOOK_BASE_URL; padrão é o domínio de produção.
  return process.env.PUBLIC_WEBHOOK_BASE_URL ?? "https://loopsale.com.br";
}

/**
 * Caminho público do webhook por plataforma. O n8n é exposto como "loop"
 * (Loop API) para não revelar a ferramenta ao cliente; o path /api/webhooks/n8n
 * continua funcionando por baixo para não quebrar fluxos já configurados.
 */
const WEBHOOK_PATH: Record<Platform, string> = {
  n8n: "loop",
  kiwify: "kiwify",
  hotmart: "hotmart",
};

function maskSecret(value: string): string {
  if (!value) return "";
  const last = value.slice(-4);
  return `••••${last}`;
}

/** Monta a visão segura da config para enviar ao cliente. */
function safeConfig(platform: Platform, config: Record<string, unknown>) {
  const out: Record<string, { value: string; secret: boolean; set: boolean }> =
    {};
  for (const field of CRED_FIELDS[platform]) {
    const raw = String(config[field.key] ?? "");
    out[field.key] = {
      value: field.secret ? maskSecret(raw) : raw,
      secret: field.secret,
      set: raw.length > 0,
    };
  }
  return out;
}

function webhookUrlFor(platform: Platform, config: Record<string, unknown>) {
  const token = config.webhookToken as string | undefined;
  return token
    ? `${baseUrl()}/api/webhooks/${WEBHOOK_PATH[platform]}?token=${token}`
    : null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const integrationsCol = await getCollection("integrations");
  const list = (await integrationsCol
    .find({ accountId: session.user.accountId })
    .toArray()) as (Integration & { _id: ObjectId })[];

  const result = list
    .filter((i) => i.platform in CRED_FIELDS)
    .map((i) => {
      const platform = i.platform as Platform;
      const config = (i.config ?? {}) as Record<string, unknown>;
      return {
        id: String(i._id),
        platform,
        active: i.active,
        webhookUrl: webhookUrlFor(platform, config),
        credentials: safeConfig(platform, config),
      };
    });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const platform = String(body.platform ?? "").toLowerCase() as Platform;
  if (!(platform in CRED_FIELDS)) {
    return NextResponse.json(
      { error: "Plataforma inválida. Use kiwify, hotmart ou n8n." },
      { status: 400 }
    );
  }

  const regenerate = body.regenerate === true;
  const rawCredentials = (body.credentials ?? {}) as Record<string, unknown>;
  const integrationsCol = await getCollection("integrations");
  const now = new Date();
  const crypto = await import("crypto");
  const accountId = session.user.accountId;

  const existing = await integrationsCol.findOne({ accountId, platform });

  // Garante um integration com webhookToken.
  let integrationId: ObjectId;
  let config: Record<string, unknown>;
  if (!existing) {
    const doc: Integration = {
      accountId,
      platform,
      config: { webhookToken: crypto.randomBytes(24).toString("base64url") },
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    const res = await integrationsCol.insertOne(
      doc as Integration & { _id?: unknown }
    );
    integrationId = res.insertedId as ObjectId;
    config = doc.config as Record<string, unknown>;
  } else {
    integrationId = existing._id as ObjectId;
    config = { ...((existing.config as Record<string, unknown>) ?? {}) };
    if (!config.webhookToken) {
      config.webhookToken = crypto.randomBytes(24).toString("base64url");
    }
  }

  const set: Record<string, unknown> = { active: true, updatedAt: now };

  if (regenerate) {
    config.webhookToken = crypto.randomBytes(24).toString("base64url");
    set["config.webhookToken"] = config.webhookToken;
  } else if (!existing?.config || !(existing.config as Record<string, unknown>).webhookToken) {
    set["config.webhookToken"] = config.webhookToken;
  }

  // Salva apenas os campos de credencial permitidos e não-vazios.
  for (const field of CRED_FIELDS[platform]) {
    const value = rawCredentials[field.key];
    if (typeof value === "string" && value.trim() !== "") {
      config[field.key] = value.trim();
      set[`config.${field.key}`] = value.trim();
    }
  }

  await integrationsCol.updateOne({ _id: integrationId }, { $set: set });

  return NextResponse.json({
    id: String(integrationId),
    platform,
    active: true,
    webhookUrl: webhookUrlFor(platform, config),
    credentials: safeConfig(platform, config),
    message: regenerate
      ? "Novo token gerado. Atualize a URL do webhook onde ela é usada."
      : "Integração salva. Não compartilhe as chaves.",
  });
}
