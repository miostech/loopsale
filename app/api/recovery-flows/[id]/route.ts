import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, mapDocs, routeObjectId } from "@/lib/db";

export async function GET(
  _request: Request,
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

  const stepsCol = await getCollection("recoveryFlowSteps");
  const steps = await stepsCol.find({ recoveryFlowId: id }).sort({ orderIndex: 1 }).toArray();
  return NextResponse.json({ ...mapDoc(flow), steps: mapDocs(steps) });
}

export async function PATCH(
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
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.active === "boolean") updates.active = body.active;
  if (typeof body.abandonmentMinutes === "number") updates.abandonmentMinutes = body.abandonmentMinutes;

  await flowsCol.updateOne(
    { _id: oid, accountId: session.user.accountId },
    { $set: updates }
  );
  const updated = await flowsCol.findOne({ _id: oid });
  return NextResponse.json(mapDoc(updated!) ?? mapDoc(flow));
}

export async function DELETE(
  _request: Request,
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

  await flowsCol.deleteOne({ _id: oid });
  const stepsCol = await getCollection("recoveryFlowSteps");
  await stepsCol.deleteMany({ recoveryFlowId: id });
  return NextResponse.json({ deleted: true });
}
