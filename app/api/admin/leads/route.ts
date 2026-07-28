import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin";
import type { DemoRequest } from "@/lib/db/types";

type SessionUser = { email?: string | null };

const STATUSES = ["novo", "contatado", "qualificado", "convertido", "descartado"];

async function guard() {
  const session = await getServerSession(authOptions);
  const email = (session?.user as SessionUser | undefined)?.email;
  return isSuperAdmin(email);
}

export async function GET() {
  if (!(await guard())) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ leads: [], counts: {} });
  }

  const col = await getCollection("demoRequests");
  const docs = (await col
    .find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray()) as (DemoRequest & { _id: ObjectId })[];

  const counts: Record<string, number> = {};
  for (const s of STATUSES) counts[s] = 0;
  for (const d of docs) counts[d.status] = (counts[d.status] ?? 0) + 1;

  const leads = docs.map((d) => ({
    id: d._id.toString(),
    source: d.source,
    status: d.status,
    name: d.name,
    email: d.email,
    contato: d.contato ?? null,
    negocio: d.negocio ?? null,
    plataforma: d.plataforma ?? null,
    faturamento: d.faturamento ?? null,
    clientes: d.clientes ?? null,
    necessidade: d.necessidade ?? null,
    createdAt: d.createdAt,
  }));

  return NextResponse.json({ leads, counts, total: docs.length });
}

export async function PATCH(request: Request) {
  if (!(await guard())) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const { id, status } = body as { id?: string; status?: string };
  if (!id || !ObjectId.isValid(id) || !status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const col = await getCollection("demoRequests");
  await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, updatedAt: new Date() } }
  );
  return NextResponse.json({ ok: true });
}
