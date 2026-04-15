import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, mapDocs } from "@/lib/db";
import type { LeadSegment } from "@/lib/db/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const segmentsCol = await getCollection("leadSegments");
  const list = await segmentsCol.find({ accountId: session.user.accountId }).toArray();
  return NextResponse.json(mapDocs(list));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const ruleType = String(body.ruleType ?? "abandoned_checkout").trim();
  const valid = ["abandoned_checkout", "purchased", "clicked_link", "responded"];
  if (!valid.includes(ruleType)) {
    return NextResponse.json(
      { error: "ruleType deve ser: abandoned_checkout, purchased, clicked_link ou responded" },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json({ error: "Nome do segmento é obrigatório" }, { status: 400 });
  }

  const now = new Date();
  const doc: LeadSegment = {
    accountId: session.user.accountId,
    name,
    ruleType,
    createdAt: now,
    updatedAt: now,
  };
  const segmentsCol = await getCollection("leadSegments");
  const result = await segmentsCol.insertOne(doc as LeadSegment & { _id?: unknown });
  const inserted = await segmentsCol.findOne({ _id: result.insertedId });
  return NextResponse.json(mapDoc(inserted!));
}
