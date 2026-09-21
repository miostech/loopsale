import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listTemplates } from "@/lib/whatsapp/cloud";
import { getCentralToken, getCentralWabaId } from "@/lib/whatsapp/central-config";

// Basta estar logado — serve a /meta-review, aberta a qualquer usuário.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const wabaId = await getCentralWabaId();
  const token = await getCentralToken();
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
