import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin";
import type { Account, Integration } from "@/lib/db/types";

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

async function guardEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email ?? null;
  return isSuperAdmin(email) ? email : null;
}

export async function GET() {
  if (!(await guardEmail())) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ empresas: [] });
  }

  const accountsCol = await getCollection("accounts");
  // Empresas com plataforma definida e ainda não aprovadas.
  const accounts = (await accountsCol
    .find({
      platform: { $in: ["kiwify", "hotmart"] },
      $or: [{ approvedAt: { $exists: false } }, { approvedAt: null }],
    })
    .sort({ createdAt: 1 })
    .toArray()) as (Account & { _id: ObjectId })[];

  const integrationsCol = await getCollection("integrations");
  const usersCol = await getCollection("users");

  const empresas = await Promise.all(
    accounts.map(async (acc) => {
      const accountId = acc._id.toString();
      const integs = (await integrationsCol
        .find({ accountId })
        .toArray()) as Integration[];

      // Contato: admin mais antigo (ou primeiro usuário) da conta.
      const contatoUsers = (await usersCol
        .find({ accountId })
        .sort({ role: 1, createdAt: 1 })
        .limit(1)
        .toArray()) as { email?: string; phone?: string | null }[];
      const contatoUser = contatoUsers[0] ?? null;

      const platformConnected = integs.some(
        (i) => i.platform === acc.platform && i.active
      );
      const loopConnected = integs.some((i) => i.platform === "n8n" && i.active);

      // Chaves cruas para o time conectar onde precisa.
      const integrations = integs
        .filter((i) => i.platform in WEBHOOK_PATH)
        .map((i) => ({
          platform: i.platform,
          active: i.active,
          config: (i.config ?? {}) as Record<string, unknown>,
          webhookUrl: webhookUrlFor(
            i.platform,
            (i.config ?? {}) as Record<string, unknown>
          ),
        }));

      return {
        id: accountId,
        name: acc.name,
        platform: acc.platform ?? null,
        createdAt: acc.createdAt,
        email: contatoUser?.email ?? "",
        phone: contatoUser?.phone ?? null,
        platformConnected,
        loopConnected,
        readyToApprove: platformConnected && loopConnected,
        integrations,
      };
    })
  );

  return NextResponse.json({ empresas });
}

export async function PATCH(request: Request) {
  const email = await guardEmail();
  if (!email) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const { id, action } = body as { id?: string; action?: string };
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const accountsCol = await getCollection("accounts");
  const now = new Date();

  if (action === "revogar") {
    await accountsCol.updateOne(
      { _id: new ObjectId(id) },
      { $set: { approvedAt: null, approvedBy: null, updatedAt: now } }
    );
    return NextResponse.json({ ok: true, approved: false });
  }

  // Aprovar (ativar).
  await accountsCol.updateOne(
    { _id: new ObjectId(id) },
    { $set: { approvedAt: now, approvedBy: email, updatedAt: now } }
  );
  return NextResponse.json({ ok: true, approved: true });
}
