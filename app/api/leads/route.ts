import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, mapDocs } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const leadsCol = await getCollection("leads");
  const filter: Record<string, unknown> = { accountId: session.user.accountId };
  if (search) {
    filter.$or = [
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }
  if (status) filter.status = status;

  const list = await leadsCol
    .find(filter)
    .sort({ updatedAt: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();

  const total = await leadsCol.countDocuments({ accountId: session.user.accountId });

  return NextResponse.json({
    leads: mapDocs(list),
    total,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const email = body.email ? String(body.email).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const name = body.name ? String(body.name).trim() : null;
  if (!email && !phone) {
    return NextResponse.json(
      { error: "Email ou telefone obrigatório" },
      { status: 400 }
    );
  }

  const leadsCol = await getCollection("leads");
  const now = new Date();
  const doc = {
    accountId: session.user.accountId,
    email,
    phone,
    name,
    source: "manual",
    status: "lead",
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  const result = await leadsCol.insertOne(doc);
  const inserted = { _id: result.insertedId, ...doc };
  return NextResponse.json(mapDoc(inserted));
}
