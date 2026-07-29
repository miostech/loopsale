import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import { chatContext, janelaAberta } from "@/lib/loopchat/access";
import { normalizePhone } from "@/lib/whatsapp/cloud";

type Agrupado = {
  _id: string;
  ultimaEm: Date;
  ultimoTexto: string | null;
  ultimaDirecao: string;
  ultimaRecebidaEm: Date | null;
  ultimaEnviadaEm: Date | null;
  total: number;
};

/** Lista as conversas do número da conta, uma por contato. */
export async function GET() {
  const ctx = await chatContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (ctx.access === "hidden") {
    return NextResponse.json(
      { error: "Com atendimento gerenciado, quem responde é a LoopSale." },
      { status: 403 }
    );
  }
  if (ctx.access === "locked") {
    return NextResponse.json({ error: "LoopChat não contratado." }, { status: 402 });
  }
  if (isDatabaseDisabled()) return NextResponse.json({ conversas: [] });

  const waCol = await getCollection("whatsappMessages");
  const rows = (await waCol
    .aggregate([
      { $match: { accountId: ctx.accountId, contact: { $ne: null } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$contact",
          ultimaEm: { $last: "$createdAt" },
          ultimoTexto: { $last: "$body" },
          ultimaDirecao: { $last: "$direction" },
          // Última recebida define a janela de 24h para texto livre.
          ultimaRecebidaEm: {
            $max: { $cond: [{ $eq: ["$direction", "in"] }, "$createdAt", null] },
          },
          // Última enviada define o que ainda não foi respondido por nós.
          ultimaEnviadaEm: {
            $max: { $cond: [{ $eq: ["$direction", "out"] }, "$createdAt", null] },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { ultimaEm: -1 } },
      { $limit: 200 },
    ])
    .toArray()) as Agrupado[];

  // Nome do contato: vem dos leads da conta, casando pelo telefone normalizado.
  const leadsCol = await getCollection("leads");
  const leads = (await leadsCol
    .find({ accountId: ctx.accountId, phone: { $ne: null } })
    .project({ phone: 1, name: 1 })
    .toArray()) as { phone?: string | null; name?: string | null }[];
  const nomePorTelefone = new Map<string, string>();
  for (const l of leads) {
    const p = normalizePhone(String(l.phone ?? ""));
    if (p && l.name && !nomePorTelefone.has(p)) nomePorTelefone.set(p, l.name);
  }

  // Não lidas = recebidas depois da última resposta nossa (igual ao badge do
  // Chatwoot). Sem resposta nossa, tudo que entrou conta.
  const naoLidasPorContato = new Map<string, number>();
  const contatos = rows.map((r) => r._id);
  if (contatos.length) {
    const pend = (await waCol
      .aggregate([
        {
          $match: {
            accountId: ctx.accountId,
            contact: { $in: contatos },
            direction: "in",
          },
        },
        { $group: { _id: "$contact", datas: { $push: "$createdAt" } } },
      ])
      .toArray()) as { _id: string; datas: Date[] }[];
    const enviadaPor = new Map(rows.map((r) => [r._id, r.ultimaEnviadaEm]));
    for (const p of pend) {
      const corte = enviadaPor.get(p._id);
      const n = corte
        ? p.datas.filter((d) => new Date(d) > new Date(corte)).length
        : p.datas.length;
      naoLidasPorContato.set(p._id, n);
    }
  }

  return NextResponse.json({
    conversas: rows.map((r) => ({
      contact: r._id,
      nome: nomePorTelefone.get(r._id) ?? null,
      ultimaEm: r.ultimaEm,
      ultimoTexto: r.ultimoTexto,
      ultimaDirecao: r.ultimaDirecao,
      janelaAberta: janelaAberta(r.ultimaRecebidaEm),
      naoLidas: naoLidasPorContato.get(r._id) ?? 0,
      total: r.total,
    })),
  });
}
