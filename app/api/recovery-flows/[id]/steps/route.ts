import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDocs, routeObjectId } from "@/lib/db";
import type { RecoveryFlowStep } from "@/lib/db/types";

const CHANNELS = ["whatsapp", "email", "sms"];

/** Substitui todas as etapas de um fluxo (replace-all). */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const oid = await routeObjectId(id);
  if (!oid) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const flowsCol = await getCollection("recoveryFlows");
  const flow = await flowsCol.findOne({
    _id: oid,
    accountId: session.user.accountId,
  });
  if (!flow) {
    return NextResponse.json({ error: "Fluxo não encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const rawSteps = Array.isArray(body.steps) ? body.steps : [];

  const now = new Date();
  const docs: RecoveryFlowStep[] = rawSteps.map(
    (s: Record<string, unknown>, i: number) => {
      const channel = String(s.channel ?? "whatsapp").toLowerCase();
      return {
        recoveryFlowId: id,
        orderIndex: i,
        delayMinutes: Math.max(0, Number(s.delayMinutes) || 0),
        channel: CHANNELS.includes(channel) ? channel : "whatsapp",
        templateId: s.templateId ? String(s.templateId) : null,
        templateBody: s.templateBody ? String(s.templateBody) : null,
        couponCode: s.couponCode ? String(s.couponCode) : null,
        createdAt: now,
        updatedAt: now,
      };
    }
  );

  const stepsCol = await getCollection("recoveryFlowSteps");
  await stepsCol.deleteMany({ recoveryFlowId: id });
  if (docs.length > 0) {
    for (const d of docs) {
      await stepsCol.insertOne(d as RecoveryFlowStep & { _id?: unknown });
    }
  }
  await flowsCol.updateOne({ _id: oid }, { $set: { updatedAt: now } });

  const saved = await stepsCol
    .find({ recoveryFlowId: id })
    .sort({ orderIndex: 1 })
    .toArray();
  return NextResponse.json({ steps: mapDocs(saved) });
}
