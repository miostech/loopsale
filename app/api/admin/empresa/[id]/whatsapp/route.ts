import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin";

type SessionUser = { email?: string | null };

/** Define o Phone Number ID (WABA central) do cliente. Só super-admin. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  if (!isSuperAdmin(email)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível" }, { status: 503 });
  }

  const { id } = await params;
  const oid = await routeObjectId(id);
  if (!oid) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const phoneNumberId =
    typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
  const displayNumber =
    typeof body.displayNumber === "string" ? body.displayNumber.trim() : "";

  const accountsCol = await getCollection("accounts");
  await accountsCol.updateOne(
    { _id: oid },
    {
      $set: {
        "whatsapp.phoneNumberId": phoneNumberId || null,
        "whatsapp.displayNumber": displayNumber || null,
        updatedAt: new Date(),
      },
    }
  );
  return NextResponse.json({ ok: true, phoneNumberId, displayNumber });
}
