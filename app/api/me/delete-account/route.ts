import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, getCollection, isDatabaseDisabled, routeObjectId } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const confirm = body.confirm === true || body.confirm === "true";
  if (!confirm) {
    return NextResponse.json(
      { error: 'Envie { "confirm": true } para confirmar a exclusão.' },
      { status: 400 }
    );
  }

  const accountId = session.user.accountId;

  if (isDatabaseDisabled()) {
    return NextResponse.json({
      message:
        "Modo demo: nada foi apagado (sem banco). Faça logout se quiser encerrar a sessão.",
    });
  }

  const db = await getDb();
  const collections = [
    "scheduledCampaignMessages",
    "campaignVariants",
    "campaignSteps",
    "campaigns",
    "scheduledRecoveryMessages",
    "recoveryFlowSteps",
    "recoveryFlows",
    "abandonedCheckouts",
    "checkoutEvents",
    "messageTemplates",
    "leads",
    "leadSegments",
    "integrations",
    "products",
    "users",
  ];
  for (const name of collections) {
    const col = db.collection(name);
    await col.deleteMany({ accountId });
  }
  const accountOid = await routeObjectId(accountId);
  if (accountOid) {
    await db.collection("accounts").deleteOne({ _id: accountOid });
  }

  return NextResponse.json({
    message: "Conta e dados associados foram excluídos. Faça logout.",
  });
}
