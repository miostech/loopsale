import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { AbandonedCheckout, Lead } from "@/lib/db/types";
import { chatContext } from "@/lib/loopchat/access";
import { normalizePhone } from "@/lib/whatsapp/cloud";

/**
 * Ficha do contato para o painel lateral: quem é e o que já passou pelo
 * checkout. É o contexto que falta para quem está respondendo.
 */
export async function GET(request: Request) {
  const ctx = await chatContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (ctx.access !== "available") {
    return NextResponse.json(
      { error: "LoopChat indisponível para esta conta." },
      { status: ctx.access === "hidden" ? 403 : 402 }
    );
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ lead: null, checkouts: [] });
  }

  const contact = normalizePhone(
    new URL(request.url).searchParams.get("contact") ?? ""
  );
  if (!contact) {
    return NextResponse.json({ error: "Contato inválido." }, { status: 400 });
  }

  // O telefone é gravado em formatos diferentes por plataforma, então o casamento
  // é feito depois de normalizar os dois lados.
  const leadsCol = await getCollection("leads");
  const leads = (await leadsCol
    .find({ accountId: ctx.accountId, phone: { $ne: null } })
    .project({ name: 1, email: 1, phone: 1, status: 1, tags: 1, createdAt: 1 })
    .toArray()) as Lead[];
  const lead = leads.find((l) => normalizePhone(String(l.phone ?? "")) === contact);

  const checkoutsCol = await getCollection("abandonedCheckouts");
  const todos = (await checkoutsCol
    .find({ accountId: ctx.accountId, customerPhone: { $ne: null } })
    .project({
      customerPhone: 1,
      productName: 1,
      amount: 1,
      currency: 1,
      recoveredAt: 1,
      paidAt: 1,
      createdAt: 1,
    })
    .sort({ createdAt: -1 })
    .limit(1000)
    .toArray()) as AbandonedCheckout[];

  const checkouts = todos
    .filter((c) => normalizePhone(String(c.customerPhone ?? "")) === contact)
    .slice(0, 8)
    .map((c) => ({
      produto: c.productName ?? "—",
      valor: c.amount ?? null,
      moeda: c.currency ?? "BRL",
      situacao: c.recoveredAt ? "recuperado" : c.paidAt ? "pago" : "em aberto",
      em: c.createdAt,
    }));

  return NextResponse.json({
    lead: lead
      ? {
          nome: lead.name ?? null,
          email: lead.email ?? null,
          telefone: lead.phone ?? null,
          status: lead.status ?? null,
          tags: lead.tags ?? [],
          desde: lead.createdAt ?? null,
        }
      : null,
    checkouts,
  });
}
