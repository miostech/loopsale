import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  centralWabaId,
  centralToken,
  getPhoneNumbers,
} from "@/lib/whatsapp/cloud";

// Basta estar logado — serve a /meta-review, aberta a qualquer usuário.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
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
    const numbers = await getPhoneNumbers(wabaId, token);
    return NextResponse.json({ numbers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 502 }
    );
  }
}
