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
  const campaignsCol = await getCollection("campaigns");
  const campaign = await campaignsCol.findOne({
    _id: oid,
    accountId: session.user.accountId,
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  }

  const stepsCol = await getCollection("campaignSteps");
  const variantsCol = await getCollection("campaignVariants");
  const steps = await stepsCol.find({ campaignId: id }).sort({ orderIndex: 1 }).toArray();
  const variants = await variantsCol.find({ campaignId: id }).toArray();
  return NextResponse.json({
    ...mapDoc(campaign),
    steps: mapDocs(steps),
    variants: mapDocs(variants),
  });
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
  const campaignsCol = await getCollection("campaigns");
  const campaign = await campaignsCol.findOne({
    _id: oid,
    accountId: session.user.accountId,
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.active === "boolean") updates.active = body.active;
  if (body.startAt !== undefined) updates.startAt = body.startAt ? new Date(body.startAt) : null;
  if (body.endAt !== undefined) updates.endAt = body.endAt ? new Date(body.endAt) : null;

  await campaignsCol.updateOne(
    { _id: oid, accountId: session.user.accountId },
    { $set: updates }
  );
  const updated = await campaignsCol.findOne({ _id: oid });
  return NextResponse.json(mapDoc(updated!) ?? mapDoc(campaign));
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
  const campaignsCol = await getCollection("campaigns");
  const campaign = await campaignsCol.findOne({
    _id: oid,
    accountId: session.user.accountId,
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  }

  await campaignsCol.deleteOne({ _id: oid });
  const stepsCol = await getCollection("campaignSteps");
  const variantsCol = await getCollection("campaignVariants");
  await stepsCol.deleteMany({ campaignId: id });
  await variantsCol.deleteMany({ campaignId: id });
  return NextResponse.json({ deleted: true });
}
