import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import {
  centralWabaId,
  centralToken,
  getWabaInfo,
  getPhoneNumbers,
} from "@/lib/whatsapp/cloud";

type SessionUser = { email?: string | null };

/** Cabeçalho da tela de review: conta conectada, WABA e número principal. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin((session?.user as SessionUser | undefined)?.email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
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
