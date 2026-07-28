import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  centralWabaId,
  centralToken,
  getWabaInfo,
  getPhoneNumbers,
} from "@/lib/whatsapp/cloud";

/** Cabeçalho da tela de review: conta conectada, WABA e número principal. */
// Basta estar logado — serve a /meta-review, aberta a qualquer usuário.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const wabaId = centralWabaId();
  const token = centralToken();
  const configured = !!(wabaId && token);
  if (!configured) {
    return NextResponse.json({ configured: false, wabaId: wabaId || null });
  }

  let wabaName: string | null = null;
  let mainNumber: string | null = null;
  let error: string | null = null;
  try {
    const info = await getWabaInfo(wabaId, token);
    wabaName = info.name || null;
    const numbers = await getPhoneNumbers(wabaId, token);
    mainNumber = numbers[0]?.displayPhoneNumber ?? null;
  } catch (e) {
    error = e instanceof Error ? e.message : "Erro ao consultar a Meta.";
  }

  return NextResponse.json({
    configured: true,
    wabaId,
    wabaName,
    mainNumber,
    error,
  });
}
