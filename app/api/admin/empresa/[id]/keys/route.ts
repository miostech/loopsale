import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin";
import type { Integration } from "@/lib/db/types";

type SessionUser = { email?: string | null };

function baseUrl(): string {
  return process.env.PUBLIC_WEBHOOK_BASE_URL ?? "https://loopsale.com.br";
}
const WEBHOOK_PATH: Record<string, string> = {
  n8n: "loop",
  kiwify: "kiwify",
  hotmart: "hotmart",
};
function webhookUrlFor(platform: string, config: Record<string, unknown>) {
  const token = config?.webhookToken as string | undefined;
  const path = WEBHOOK_PATH[platform] ?? platform;
  return token ? `${baseUrl()}/api/webhooks/${path}?token=${token}` : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ integrations: [] });
  }

  const { id } = await params;
  const oid = await routeObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const integrationsCol = await getCollection("integrations");
  const integs = (await integrationsCol
    .find({ accountId: id })
    .toArray()) as Integration[];

  const integrations = integs
    .filter((i) => i.platform in WEBHOOK_PATH)
    .map((i) => {
      const config = (i.config ?? {}) as Record<string, unknown>;
      return {
        platform: i.platform,
        active: i.active,
        config,
        webhookUrl: webhookUrlFor(i.platform, config),
      };
    });

  return NextResponse.json({ integrations });
}
