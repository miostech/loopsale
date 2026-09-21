import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { centralWabaId } from "@/lib/whatsapp/cloud";
import { setCentralToken, centralTokenFromDb } from "@/lib/whatsapp/central-config";

type SessionUser = { email?: string | null };

/**
 * Configurações da WABA central (LoopSale) — só super-admin.
 * GET: mostra verify token, WABA e a origem do token da API (banco/env/nenhum).
 * PATCH: atualiza o token da API sem redeploy (grava no banco).
 * Nunca devolve o valor do token da API.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const noBanco = await centralTokenFromDb();
  const temEnv = !!(process.env.WHATSAPP_ACCESS_TOKEN ?? "").trim();
  return NextResponse.json({
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
    wabaId: centralWabaId(),
    webhookUrl: `${process.env.NEXTAUTH_URL ?? ""}/api/webhooks/whatsapp`,
    tokenSource: noBanco ? "banco" : temEnv ? "env" : "nenhum",
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const token = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Informe o token da API." }, { status: 400 });
  }
  await setCentralToken(token);
  return NextResponse.json({ ok: true, tokenSource: "banco" });
}
