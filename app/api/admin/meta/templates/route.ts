import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import {
  centralWabaId,
  centralToken,
  listTemplates,
} from "@/lib/whatsapp/cloud";

type SessionUser = { email?: string | null };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin((session?.user as SessionUser | undefined)?.email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  const wabaId = centralWabaId();
  const token = centralToken();
  if (!wabaId || !token) {
    return NextResponse.json(
      { error: "WHATSAPP_WABA_ID / WHATSAPP_ACCESS_TOKEN não configurados." },
      { status: 400 }
    );
  }
  try {
    const templates = await listTemplates(wabaId, token);
    return NextResponse.json({ templates });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 502 }
    );
  }
}
