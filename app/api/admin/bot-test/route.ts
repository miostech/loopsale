import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/admin";
import { testAttendant } from "@/lib/ai/attendant";

type SessionUser = { email?: string | null };

/** Testa a IA do bot (chave + modelo) e devolve o erro real. Só super-admin. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  const r = await testAttendant();
  return NextResponse.json(r);
}
