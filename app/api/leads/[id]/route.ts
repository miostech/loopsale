import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, routeObjectId } from "@/lib/db";

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
  const leadsCol = await getCollection("leads");
  const lead = await leadsCol.findOne({
    _id: oid,
    accountId: session.user.accountId,
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const email = lead.email ?? "";
  const phone = lead.phone ?? "";
  const events: { type: string; date: string; data?: Record<string, unknown> }[] = [];
  const accountId = session.user.accountId;

  if (email || phone) {
    const checkoutEventsCol = await getCollection("checkoutEvents");
    const abandonedCol = await getCollection("abandonedCheckouts");
    const evFilter: Record<string, unknown> = { accountId };
    if (email && phone) {
      evFilter.$or = [
        { customerEmail: email },
        { customerPhone: phone },
      ];
    } else if (email) {
      evFilter.customerEmail = email;
    } else {
      evFilter.customerPhone = phone;
    }

    const evs = await checkoutEventsCol
      .find(evFilter)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    for (const e of evs) {
      events.push({
        type: e.eventType,
        date: e.createdAt.toISOString(),
        data: {
          product: e.productName,
          amount: e.amount,
          platform: e.platform,
          affiliate: e.affiliate,
        },
      });
    }

    const abandons = await abandonedCol
      .find(evFilter)
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    for (const a of abandons) {
      events.push({
        type: a.recoveredAt ? "recuperado" : "abandono",
        date: a.createdAt.toISOString(),
        data: {
          product: a.productName,
          amount: a.amount,
          affiliate: a.affiliate,
          recoveredAt: a.recoveredAt?.toISOString(),
        },
      });
    }
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const mapped = mapDoc(lead);
  return NextResponse.json({ ...mapped, timeline: events.slice(0, 30) });
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
  const leadsCol = await getCollection("leads");
  const lead = await leadsCol.findOne({
    _id: oid,
    accountId: session.user.accountId,
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.status === "string") updates.status = body.status;
  if (Array.isArray(body.tags)) updates.tags = body.tags;

  await leadsCol.updateOne(
    { _id: oid, accountId: session.user.accountId },
    { $set: updates }
  );
  const updated = await leadsCol.findOne({ _id: oid });
  return NextResponse.json(mapDoc(updated!) ?? mapDoc(lead));
}
