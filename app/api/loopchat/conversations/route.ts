import { NextResponse } from "next/server";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Conversation } from "@/lib/db/types";
import { chatContext, janelaAberta } from "@/lib/loopchat/access";
import { isDemoContext, demoConversasPayload } from "@/lib/loopchat/demo";
import { normalizePhone } from "@/lib/whatsapp/cloud";
import { channelsOf, conversationChannelKey } from "@/lib/whatsapp/channels";

/** Ordem também é a de urgência, usada para ordenar a lista. */
export const PRIORIDADES = ["urgent", "high", "medium", "low"];

/** Quanto tempo cada opção de adiamento vale. */
const ADIAMENTOS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

/**
 * Status que vale para a listagem: adiada com prazo vencido volta a ser aberta
 * sozinha, sem job. Só grava no banco quando alguém age.
 */
function statusEfetivo(
  status: string | undefined,
  snoozedUntil: Date | null | undefined,
  agora: number
): string {
  if (status === "snoozed") {
    if (!snoozedUntil || new Date(snoozedUntil).getTime() <= agora) return "open";
  }
  return status ?? "open";
}

type Agrupado = {
  _id: { contact: string; phoneNumberId: string | null };
  ultimaEm: Date;
  ultimoTexto: string | null;
  ultimaDirecao: string;
  ultimaRecebidaEm: Date | null;
  ultimaEnviadaEm: Date | null;
  total: number;
};

/** Chave de uma conversa: contato + canal (phoneNumberId). */
function chaveConversa(contact: string, phoneNumberId: string | null): string {
  return `${contact}|${phoneNumberId ?? ""}`;
}

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
  if (isDemoContext(ctx)) {
    return NextResponse.json(demoConversasPayload(ctx.userId));
  }
  if (isDatabaseDisabled()) return NextResponse.json({ conversas: [] });

  const waCol = await getCollection("whatsappMessages");
  const rows = (await waCol
    .aggregate([
      // Nota interna não é mensagem da conversa: fora da prévia, da direção da
      // última e das não lidas.
      { $match: { accountId: ctx.accountId, contact: { $ne: null }, internal: { $ne: true } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          // Uma conversa por contato + canal (phoneNumberId): o mesmo cliente
          // numa caixa diferente é outra conversa.
          _id: { contact: "$contact", phoneNumberId: "$phoneNumberId" },
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
  // Chatwoot). Sem resposta nossa, tudo que entrou conta. Por contato + canal.
  const naoLidasPorConversa = new Map<string, number>();
  const contatos = [...new Set(rows.map((r) => r._id.contact))];
  if (contatos.length) {
    const pend = (await waCol
      .aggregate([
        {
          $match: {
            accountId: ctx.accountId,
            contact: { $in: contatos },
            direction: "in",
            internal: { $ne: true },
          },
        },
        {
          $group: {
            _id: { contact: "$contact", phoneNumberId: "$phoneNumberId" },
            datas: { $push: "$createdAt" },
          },
        },
      ])
      .toArray()) as {
      _id: { contact: string; phoneNumberId: string | null };
      datas: Date[];
    }[];
    const enviadaPor = new Map(
      rows.map((r) => [
        chaveConversa(r._id.contact, r._id.phoneNumberId),
        r.ultimaEnviadaEm,
      ])
    );
    for (const p of pend) {
      const chave = chaveConversa(p._id.contact, p._id.phoneNumberId);
      const corte = enviadaPor.get(chave);
      const n = corte
        ? p.datas.filter((d) => new Date(d) > new Date(corte)).length
        : p.datas.length;
      naoLidasPorConversa.set(chave, n);
    }
  }

  // Estado da conversa. Sem documento = aberta, então nenhuma conversa some
  // por falta de registro. Casa por contato + canal; docs legados (sem canal)
  // servem de fallback para não perder o estado antigo.
  const convCol = await getCollection("conversations");
  const convs = (await convCol
    .find({ accountId: ctx.accountId, contact: { $in: contatos } })
    .toArray()) as Conversation[];
  const convExata = new Map<string, Conversation>();
  const convLegado = new Map<string, Conversation>();
  for (const c of convs) {
    if (c.phoneNumberId) {
      convExata.set(chaveConversa(c.contact, c.phoneNumberId), c);
    } else {
      convLegado.set(c.contact, c);
    }
  }
  const estadoDaConversa = (r: Agrupado): Conversation | undefined =>
    convExata.get(chaveConversa(r._id.contact, r._id.phoneNumberId)) ??
    convLegado.get(r._id.contact);

  // Nome do responsável: uma leitura dos membros da conta, não uma por conversa.
  const usersCol = await getCollection("users");
  const membros = (await usersCol
    .find({ accountId: ctx.accountId })
    .project({ name: 1, email: 1 })
    .toArray()) as { _id: unknown; name?: string | null; email?: string }[];
  const membroPorId = new Map(
    membros.map((m) => [String(m._id), m.name || m.email || "Membro"])
  );

  // Etiquetas da conta = as que estão em uso, com quantas conversas cada uma.
  const usoEtiquetas = new Map<string, number>();
  for (const c of convs) {
    for (const l of c.labels ?? []) {
      usoEtiquetas.set(l, (usoEtiquetas.get(l) ?? 0) + 1);
    }
  }

  const agoraMs = Date.now();

  // Canais (caixas) da conta, para a sidebar filtrar por número.
  const canais = channelsOf(ctx.account).map((c) => ({
    phoneNumberId: c.phoneNumberId,
    name: c.name,
    displayNumber: c.displayNumber ?? null,
  }));

  return NextResponse.json({
    usuarioAtual: ctx.userId,
    canais,
    etiquetas: [...usoEtiquetas.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    conversas: rows.map((r) => {
      const conv = estadoDaConversa(r);
      const contact = r._id.contact;
      const phoneNumberId = r._id.phoneNumberId ?? null;
      const assigneeId = conv?.assigneeId ?? null;
      return {
      contact,
      phoneNumberId,
      status: statusEfetivo(conv?.status, conv?.snoozedUntil, agoraMs),
      snoozedUntil: conv?.snoozedUntil ?? null,
      assigneeId,
      assigneeNome: assigneeId ? membroPorId.get(assigneeId) ?? null : null,
      labels: conv?.labels ?? [],
      priority: conv?.priority ?? null,
      botPaused: !!conv?.botPaused,
      nome: nomePorTelefone.get(contact) ?? conv?.waName ?? null,
      ultimaEm: r.ultimaEm,
      ultimoTexto: r.ultimoTexto,
      ultimaDirecao: r.ultimaDirecao,
      janelaAberta: janelaAberta(r.ultimaRecebidaEm),
      naoLidas: naoLidasPorConversa.get(chaveConversa(contact, phoneNumberId)) ?? 0,
      total: r.total,
      };
    }),
  });
}

/** Resolve ou reabre uma conversa. */
export async function PATCH(request: Request) {
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
  // Demo é só vitrine: aceita a ação mas não persiste nada.
  if (isDemoContext(ctx)) return NextResponse.json({ ok: true });

  const body = await request.json().catch(() => ({}));
  const contact = normalizePhone(String(body.contact ?? ""));
  // Canal (caixa) da conversa para o estado. Só separa em contas multi-número;
  // conta de número único fica null (compatível com os docs legados).
  const phoneNumberId = conversationChannelKey(
    ctx.account,
    body.channel ? String(body.channel) : null
  );
  const acao = String(body.action ?? "");
  if (
    !contact ||
    ![
      "resolver",
      "reabrir",
      "atribuir",
      "etiquetar",
      "priorizar",
      "pendente",
      "adiar",
    ].includes(acao)
  ) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const now = new Date();

  if (acao === "pendente" || acao === "adiar") {
    const adiar = acao === "adiar";
    const prazo = String(body.prazo ?? "24h");
    if (adiar && !ADIAMENTOS[prazo]) {
      return NextResponse.json(
        { error: "Prazo de adiamento inválido." },
        { status: 400 }
      );
    }
    const snoozedUntil = adiar
      ? new Date(now.getTime() + ADIAMENTOS[prazo])
      : null;
    const convCol = await getCollection("conversations");
    await convCol.updateOne(
      { accountId: ctx.accountId, contact, phoneNumberId },
      {
        $set: {
          status: adiar ? "snoozed" : "pending",
          snoozedUntil,
          resolvedAt: null,
          updatedAt: now,
        },
        $setOnInsert: { accountId: ctx.accountId, contact, phoneNumberId, createdAt: now },
      },
      { upsert: true }
    );
    return NextResponse.json({
      ok: true,
      status: adiar ? "snoozed" : "pending",
      snoozedUntil,
    });
  }

  if (acao === "priorizar") {
    const priority = body.priority ? String(body.priority) : null;
    if (priority && !PRIORIDADES.includes(priority)) {
      return NextResponse.json({ error: "Prioridade inválida." }, { status: 400 });
    }
    const convCol = await getCollection("conversations");
    await convCol.updateOne(
      { accountId: ctx.accountId, contact, phoneNumberId },
      {
        $set: { priority, updatedAt: now },
        $setOnInsert: {
          accountId: ctx.accountId,
          contact,
          phoneNumberId,
          status: "open",
          createdAt: now,
        },
      },
      { upsert: true }
    );
    return NextResponse.json({ ok: true, priority });
  }

  if (acao === "etiquetar") {
    // Recebe a lista final da conversa. Normaliza para não criar "VIP", "vip"
    // e " vip " como três etiquetas diferentes.
    const labels = Array.isArray(body.labels)
      ? Array.from(
          new Set(
            body.labels
              .map((l: unknown) => String(l).trim().toLowerCase())
              .filter((l: string) => l.length > 0 && l.length <= 24)
          )
        ).slice(0, 10)
      : [];
    const convCol = await getCollection("conversations");
    await convCol.updateOne(
      { accountId: ctx.accountId, contact, phoneNumberId },
      {
        $set: { labels, updatedAt: now },
        $setOnInsert: {
          accountId: ctx.accountId,
          contact,
          phoneNumberId,
          status: "open",
          createdAt: now,
        },
      },
      { upsert: true }
    );
    return NextResponse.json({ ok: true, labels });
  }

  if (acao === "atribuir") {
    // null = tirar o responsável. Só aceita membro da própria conta.
    const assigneeId = body.assigneeId ? String(body.assigneeId) : null;
    if (assigneeId) {
      const usersCol = await getCollection("users");
      const oid = await routeObjectId(assigneeId);
      const membro = oid
        ? await usersCol.findOne({ _id: oid, accountId: ctx.accountId })
        : null;
      if (!membro) {
        return NextResponse.json(
          { error: "Membro não encontrado nesta conta." },
          { status: 400 }
        );
      }
    }
    const convCol = await getCollection("conversations");
    await convCol.updateOne(
      { accountId: ctx.accountId, contact, phoneNumberId },
      {
        $set: {
          assigneeId,
          assignedAt: assigneeId ? now : null,
          updatedAt: now,
        },
        $setOnInsert: {
          accountId: ctx.accountId,
          contact,
          phoneNumberId,
          status: "open",
          createdAt: now,
        },
      },
      { upsert: true }
    );
    return NextResponse.json({ ok: true, assigneeId });
  }
  const resolvida = acao === "resolver";
  const convCol = await getCollection("conversations");
  await convCol.updateOne(
    { accountId: ctx.accountId, contact },
    {
      $set: {
        status: resolvida ? "resolved" : "open",
        resolvedAt: resolvida ? now : null,
        resolvedBy: resolvida ? ctx.email ?? "" : null,
        // Reabrir também cancela adiamento pendente.
        snoozedUntil: null,
        updatedAt: now,
      },
      $setOnInsert: { accountId: ctx.accountId, contact, createdAt: now },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true, status: resolvida ? "resolved" : "open" });
}
