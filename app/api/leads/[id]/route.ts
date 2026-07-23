import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, mapDoc, routeObjectId } from "@/lib/db";
import type { CheckoutEvent, AbandonedCheckout } from "@/lib/db/types";

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
  const accountId = session.user.accountId;

  const toNum = (v: unknown) => parseFloat(String(v ?? "0")) || 0;
  const isUsd = (c: unknown) =>
    String(c ?? "BRL").toUpperCase() === "USD";
  const eventCurrency = (e: {
    currency?: string | null;
    payload?: Record<string, unknown>;
  }) =>
    (e.currency ??
      (e.payload?.moeda as string | undefined) ??
      (e.payload?.currency as string | undefined) ??
      "BRL") as string;

  const events: {
    type: string;
    date: string;
    data: Record<string, unknown>;
  }[] = [];

  const summary = {
    compras: 0,
    abandonos: 0,
    recuperados: 0,
    recusados: 0,
    mensagens: 0,
    totalGastoBrl: 0,
    totalGastoUsd: 0,
    primeiroContato: null as string | null,
    ultimoContato: null as string | null,
  };

  // Agregação por produto.
  type Prod = {
    produto: string;
    iniciados: number;
    abandonos: number;
    compras: number;
    recuperados: number;
    valorBrl: number;
    valorUsd: number;
    ultimaData: string | null;
  };
  const produtos = new Map<string, Prod>();
  const ensureProd = (name: string): Prod => {
    const key = name || "—";
    if (!produtos.has(key))
      produtos.set(key, {
        produto: key,
        iniciados: 0,
        abandonos: 0,
        compras: 0,
        recuperados: 0,
        valorBrl: 0,
        valorUsd: 0,
        ultimaData: null,
      });
    return produtos.get(key)!;
  };
  const bumpDate = (p: Prod, date: string) => {
    if (!p.ultimaData || date > p.ultimaData) p.ultimaData = date;
  };

  if (email || phone) {
    const checkoutEventsCol = await getCollection("checkoutEvents");
    const abandonedCol = await getCollection("abandonedCheckouts");
    const evFilter: Record<string, unknown> = { accountId };
    if (email && phone) {
      evFilter.$or = [{ customerEmail: email }, { customerPhone: phone }];
    } else if (email) {
      evFilter.customerEmail = email;
    } else {
      evFilter.customerPhone = phone;
    }

    const evs = (await checkoutEventsCol
      .find(evFilter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()) as CheckoutEvent[];

    for (const e of evs) {
      const date = e.createdAt.toISOString();
      const currency = eventCurrency(e);
      const amount = toNum(e.amount);
      events.push({
        type: e.eventType,
        date,
        data: {
          product: e.productName,
          amount: e.amount,
          currency,
          platform: e.platform,
          affiliate: e.affiliate,
          refundStatus:
            e.eventType === "reembolso"
              ? (e.payload?.status as string | undefined)
              : undefined,
          refundReason:
            e.eventType === "reembolso"
              ? ((e.payload?.motivo ?? e.payload?.reason) as string | undefined)
              : undefined,
          refundRequester:
            e.eventType === "reembolso"
              ? ((e.payload?.solicitante ??
                  e.payload?.requester ??
                  e.payload?.requested_by) as string | undefined)
              : undefined,
          wamid: (e.whatsappMessageId ?? e.payload?.wamid) as
            | string
            | undefined,
        },
      });

      if (e.eventType === "whatsapp_enviado") summary.mensagens++;
      if (e.eventType === "pagamento_recusado") summary.recusados++;
      if (e.eventType === "checkout_iniciado" && e.productName)
        bumpDate(ensureProd(e.productName), date);
      if (e.eventType === "checkout_iniciado" && e.productName)
        ensureProd(e.productName).iniciados++;

      if (e.eventType === "pagamento_aprovado") {
        summary.compras++;
        if (isUsd(currency)) summary.totalGastoUsd += amount;
        else summary.totalGastoBrl += amount;
        if (e.productName) {
          const p = ensureProd(e.productName);
          p.compras++;
          if (isUsd(currency)) p.valorUsd += amount;
          else p.valorBrl += amount;
          bumpDate(p, date);
        }
      }
    }

    const abandons = (await abandonedCol
      .find(evFilter)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()) as AbandonedCheckout[];

    for (const a of abandons) {
      const date = a.createdAt.toISOString();
      const recovered = !!a.recoveredAt;
      summary.abandonos++;
      if (recovered) summary.recuperados++;
      events.push({
        type: recovered ? "recuperado" : "abandono",
        date,
        data: {
          product: a.productName,
          amount: recovered ? a.recoveredAmount ?? a.amount : a.amount,
          currency: recovered ? a.recoveredCurrency ?? "BRL" : a.currency ?? "BRL",
          affiliate: a.affiliate,
          recoveryType: a.recoveryType ?? "abandoned",
          recoveredAt: a.recoveredAt?.toISOString(),
        },
      });
      if (a.productName) {
        const p = ensureProd(a.productName);
        p.abandonos++;
        if (recovered) p.recuperados++;
        bumpDate(p, date);
      }
    }
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (events.length > 0) {
    summary.ultimoContato = events[0].date;
    summary.primeiroContato = events[events.length - 1].date;
  }

  const mapped = mapDoc(lead);
  return NextResponse.json({
    ...mapped,
    summary,
    produtos: Array.from(produtos.values()).sort(
      (a, b) => b.compras - a.compras || b.abandonos - a.abandonos
    ),
    timeline: events.slice(0, 40),
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
