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
  const source = url.searchParams.get("source") ?? "";
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
  // Padrão (status vazio) mostra só os clientes "ativos": lead e comprou. Para
  // ver pago/reembolso/etc., o usuário escolhe o status no filtro; "all" mostra
  // todos.
  if (!status) {
    filter.status = { $in: ["lead", "purchased"] };
  } else if (status !== "all") {
    filter.status = status;
  }
  if (source) filter.source = source;

  const list = await leadsCol
    .find(filter)
    .sort({ updatedAt: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();

  // Total considerando os filtros aplicados (para paginação correta).
  const total = await leadsCol.countDocuments(filter);

  // Contagens por status sobre toda a base (para os cards de resumo),
  // independentes dos filtros de busca/status/origem.
  const statusRows = (await leadsCol
    .aggregate([
      { $match: { accountId: session.user.accountId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    .toArray()) as { _id: string; count: number }[];
  const statusCounts: Record<string, number> = {};
  let baseTotal = 0;
  for (const row of statusRows) {
    statusCounts[row._id ?? "lead"] = row.count;
    baseTotal += row.count;
  }

  return NextResponse.json({
    leads: mapDocs(list),
    total,
    baseTotal,
    statusCounts,
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
