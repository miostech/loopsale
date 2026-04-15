import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, mapDocs } from "@/lib/db";
import type { RecoveryFlow, RecoveryFlowStep } from "@/lib/db/types";

const DEFAULT_STEPS = [
  { delayMinutes: 10, channel: "whatsapp" },
  { delayMinutes: 360, channel: "email" },
  { delayMinutes: 1440, channel: "whatsapp" },
  { delayMinutes: 2880, channel: "email" },
] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const flowsCol = await getCollection("recoveryFlows");
  const flows = await flowsCol.find({ accountId: session.user.accountId }).toArray();
  return NextResponse.json(mapDocs(flows));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "Fluxo de recuperação").trim();
  const productId = body.productId ?? null;
  const abandonmentMinutes = Number(body.abandonmentMinutes) || 30;

  const now = new Date();
  const flowDoc: RecoveryFlow = {
    accountId: session.user.accountId,
    name,
    productId,
    active: true,
    abandonmentMinutes,
    createdAt: now,
    updatedAt: now,
  };
  const flowsCol = await getCollection("recoveryFlows");
  const result = await flowsCol.insertOne(flowDoc as RecoveryFlow & { _id?: unknown });
  const flowId = result.insertedId.toString();

  const stepsCol = await getCollection("recoveryFlowSteps");
  for (let i = 0; i < DEFAULT_STEPS.length; i++) {
    const stepDoc: RecoveryFlowStep = {
      recoveryFlowId: flowId,
      orderIndex: i,
      delayMinutes: DEFAULT_STEPS[i].delayMinutes,
      channel: DEFAULT_STEPS[i].channel,
      templateBody: `Mensagem de recuperação - passo ${i + 1}. Link: {{checkout_link}}`,
      createdAt: now,
      updatedAt: now,
    };
    await stepsCol.insertOne(stepDoc as RecoveryFlowStep & { _id?: unknown });
  }

  const flow = await flowsCol.findOne({ _id: result.insertedId });
  return NextResponse.json(mapDoc(flow!));
}
