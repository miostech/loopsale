import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, routeObjectId } from "@/lib/db";

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

  const templatesCol = await getCollection("messageTemplates");
  const existing = await templatesCol.findOne({
    _id: oid,
    accountId: session.user.accountId,
  });
  if (!existing) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.body === "string") updates.body = body.body.trim();
  if (typeof body.subject === "string") updates.subject = body.subject.trim();
  if (typeof body.metaTemplateName === "string")
    updates.metaTemplateName = body.metaTemplateName.trim() || null;
  if (typeof body.language === "string")
    updates.language = body.language.trim() || null;
  if (Array.isArray(body.variables))
    updates.variables = body.variables
      .map((v: unknown) => String(v).trim())
      .filter(Boolean);

  await templatesCol.updateOne(
    { _id: oid, accountId: session.user.accountId },
    { $set: updates }
  );
  const updated = await templatesCol.findOne({ _id: oid });
  return NextResponse.json(mapDoc(updated!));
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

  const templatesCol = await getCollection("messageTemplates");
  const existing = await templatesCol.findOne({
    _id: oid,
    accountId: session.user.accountId,
  });
  if (!existing) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  await templatesCol.deleteOne({ _id: oid });
  return NextResponse.json({ deleted: true });
}
