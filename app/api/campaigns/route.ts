import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, mapDocs } from "@/lib/db";
import type { Campaign } from "@/lib/db/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const campaignsCol = await getCollection("campaigns");
  const list = await campaignsCol.find({ accountId: session.user.accountId }).toArray();
  return NextResponse.json(mapDocs(list));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "Nova campanha").trim();
  const type = String(body.type ?? "recovery_old").trim();
  const validTypes = ["launch", "recovery_old", "upsell", "limited_offer"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: "Tipo inválido. Use: launch, recovery_old, upsell, limited_offer" },
      { status: 400 }
    );
  }

  const now = new Date();
  const doc: Campaign = {
    accountId: session.user.accountId,
    name,
    type,
    segmentId: body.segmentId ?? null,
    startAt: body.startAt ? new Date(body.startAt) : null,
    endAt: body.endAt ? new Date(body.endAt) : null,
    active: false,
    createdAt: now,
    updatedAt: now,
  };
  const campaignsCol = await getCollection("campaigns");
  const result = await campaignsCol.insertOne(doc as Campaign & { _id?: unknown });
  const inserted = await campaignsCol.findOne({ _id: result.insertedId });
  return NextResponse.json(mapDoc(inserted!));
}
