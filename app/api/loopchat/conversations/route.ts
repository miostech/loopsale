import { NextResponse } from "next/server";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Conversation } from "@/lib/db/types";
import {
  chatContext,
  janelaAberta,
  resolveChatAccount,
  allAdminChannels,
} from "@/lib/loopchat/access";
import { isDemoContext, demoConversasPayload } from "@/lib/loopchat/demo";
import { normalizePhone, soDigitos } from "@/lib/whatsapp/cloud";
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
  _id: { accountId: string; contact: string; phoneNumberId: string | null };
  ultimaEm: Date;
  ultimoTexto: string | null;
  ultimaDirecao: string;
  ultimaRecebidaEm: Date | null;
  ultimaEnviadaEm: Date | null;
  total: number;
};

/** Chave de uma conversa: conta + contato + canal (phoneNumberId). */
function chaveConversa(
  accountId: string,
  contact: string,
  phoneNumberId: string | null
): string {
  return `${accountId}|${contact}|${phoneNumberId ?? ""}`;
}
/** Chave de fallback (estado legado sem canal): conta + contato. */
function chaveLegado(accountId: string, contact: string): string {
  return `${accountId}|${contact}`;
}

/** Lista as conversas do número da conta, uma por contato. */
export async function GET(request: Request) {
  const ctx = await chatContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  // Admin da LoopSale enxerga a caixa de qualquer empresa — não é barrado pelo
  // acesso da própria conta.
  if (!ctx.isAdmin) {
    if (ctx.access === "hidden") {
      return NextResponse.json(
        { error: "Com atendimento gerenciado, quem responde é a LoopSale." },
        { status: 403 }
      );
    }
    if (ctx.access === "locked") {
      return NextResponse.json({ error: "LoopChat não contratado." }, { status: 402 });
    }
  }
  if (isDemoContext(ctx)) {
    return NextResponse.json(demoConversasPayload(ctx.userId));
  }
  if (isDatabaseDisabled()) return NextResponse.json({ conversas: [] });

  const url = new URL(request.url);
  // Múltiplos canais selecionados (admin: caixas de várias empresas). Aceita
  // "channels" (lista) e o "channel" único (compat).
  const paramChannels = url.searchParams.get("channels");
  const paramChannel = url.searchParams.get("channel");
  const selecionados = [
    ...(paramChannels ? paramChannels.split(",") : []),
    ...(paramChannel ? [paramChannel] : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  // Match das mensagens: admin cruza por número (independente da empresa); os
  // demais ficam presos à própria conta.
  const base = { contact: { $ne: null }, internal: { $ne: true } };
  let matchMsgs: Record<string, unknown>;
  if (ctx.isAdmin) {
    // Sem número marcado, o admin não vê conversas (só escolhe nas caixas).
    if (!selecionados.length) {
      return NextResponse.json({
        usuarioAtual: ctx.userId,
        isAdmin: true,
        canais: await allAdminChannels(),
        etiquetas: [],
        conversas: [],
      });
    }
    matchMsgs = { ...base, phoneNumberId: { $in: selecionados } };
  } else {
    matchMsgs = {
      accountId: ctx.accountId,
      ...base,
      ...(selecionados.length ? { phoneNumberId: { $in: selecionados } } : {}),
    };
  }

  const waCol = await getCollection("whatsappMessages");
  const rows = (await waCol
    .aggregate([
      { $match: matchMsgs },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          // Uma conversa por conta + contato + canal (phoneNumberId).
          _id: {
            accountId: "$accountId",
            contact: "$contact",
            phoneNumberId: "$phoneNumberId",
          },
          ultimaEm: { $last: "$createdAt" },
          ultimoTexto: { $last: "$body" },
          ultimaDirecao: { $last: "$direction" },
          ultimaRecebidaEm: {
            $max: { $cond: [{ $eq: ["$direction", "in"] }, "$createdAt", null] },
          },
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

  const accountIds = [...new Set(rows.map((r) => r._id.accountId))];
  const contatos = [...new Set(rows.map((r) => r._id.contact))];

  // Nome do contato: leads das contas envolvidas, casados por telefone.
  const leadsCol = await getCollection("leads");
  const leads = (await leadsCol
    .find({ accountId: { $in: accountIds }, phone: { $ne: null } })
    .project({ accountId: 1, phone: 1, name: 1 })
    .toArray()) as {
    accountId?: string;
    phone?: string | null;
    name?: string | null;
  }[];
  const nomePorTelefone = new Map<string, string>();
  for (const l of leads) {
    const p = normalizePhone(String(l.phone ?? ""));
    const k = `${l.accountId}|${p}`;
    if (p && l.name && !nomePorTelefone.has(k)) nomePorTelefone.set(k, l.name);
  }

  // Não lidas: recebidas depois da última resposta nossa, por conversa.
  const naoLidasPorConversa = new Map<string, number>();
  if (contatos.length) {
    const pend = (await waCol
      .aggregate([
        { $match: { ...matchMsgs, contact: { $in: contatos }, direction: "in" } },
        {
          $group: {
            _id: {
              accountId: "$accountId",
              contact: "$contact",
              phoneNumberId: "$phoneNumberId",
            },
            datas: { $push: "$createdAt" },
          },
        },
      ])
      .toArray()) as {
      _id: { accountId: string; contact: string; phoneNumberId: string | null };
      datas: Date[];
    }[];
    const enviadaPor = new Map(
      rows.map((r) => [
        chaveConversa(r._id.accountId, r._id.contact, r._id.phoneNumberId),
        r.ultimaEnviadaEm,
      ])
    );
    for (const p of pend) {
      const chave = chaveConversa(p._id.accountId, p._id.contact, p._id.phoneNumberId);
      const corte = enviadaPor.get(chave);
      const n = corte
        ? p.datas.filter((d) => new Date(d) > new Date(corte)).length
        : p.datas.length;
      naoLidasPorConversa.set(chave, n);
    }
  }

  // Estado da conversa (por conta + contato + canal; legado sem canal = fallback).
  const convCol = await getCollection("conversations");
  const convs = (await convCol
    .find({ accountId: { $in: accountIds }, contact: { $in: contatos } })
    .toArray()) as Conversation[];
  const convExata = new Map<string, Conversation>();
  const convLegado = new Map<string, Conversation>();
  for (const c of convs) {
    if (c.phoneNumberId) {
      convExata.set(chaveConversa(c.accountId, c.contact, c.phoneNumberId), c);
    } else {
      convLegado.set(chaveLegado(c.accountId, c.contact), c);
    }
  }
  const estadoDaConversa = (r: Agrupado): Conversation | undefined =>
    convExata.get(chaveConversa(r._id.accountId, r._id.contact, r._id.phoneNumberId)) ??
    convLegado.get(chaveLegado(r._id.accountId, r._id.contact));

  // Nome do responsável: membros das contas envolvidas.
  const usersCol = await getCollection("users");
  const membros = (await usersCol
    .find({ accountId: { $in: accountIds } })
    .project({ name: 1, email: 1 })
    .toArray()) as { _id: unknown; name?: string | null; email?: string }[];
  const membroPorId = new Map(
    membros.map((m) => [String(m._id), m.name || m.email || "Membro"])
  );

  // Etiquetas em uso (só faz sentido numa conta; no admin fica vazio).
  const usoEtiquetas = new Map<string, number>();
  if (!ctx.isAdmin) {
    for (const c of convs) {
      for (const l of c.labels ?? []) {
        usoEtiquetas.set(l, (usoEtiquetas.get(l) ?? 0) + 1);
      }
    }
  }

  const agoraMs = Date.now();

  // Canais: admin vê os de todas as empresas; os demais, os da própria conta.
  const canais = ctx.isAdmin
    ? await allAdminChannels()
    : channelsOf(ctx.account).map((c) => ({
        phoneNumberId: c.phoneNumberId,
        name: c.name,
        displayNumber: c.displayNumber ?? null,
      }));

  return NextResponse.json({
    usuarioAtual: ctx.userId,
    isAdmin: ctx.isAdmin,
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
        nome:
          nomePorTelefone.get(`${r._id.accountId}|${contact}`) ??
          conv?.waName ??
          null,
        ultimaEm: r.ultimaEm,
        ultimoTexto: r.ultimoTexto,
        ultimaDirecao: r.ultimaDirecao,
        janelaAberta: janelaAberta(r.ultimaRecebidaEm),
        naoLidas:
          naoLidasPorConversa.get(
            chaveConversa(r._id.accountId, contact, phoneNumberId)
          ) ?? 0,
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
  if (!ctx.isAdmin && ctx.access !== "available") {
    return NextResponse.json(
      { error: "LoopChat indisponível para esta conta." },
      { status: ctx.access === "hidden" ? 403 : 402 }
    );
  }
  // Demo é só vitrine: aceita a ação mas não persiste nada.
  if (isDemoContext(ctx)) return NextResponse.json({ ok: true });

  const body = await request.json().catch(() => ({}));
  const contact = soDigitos(String(body.contact ?? ""));
  const canalReq = body.channel ? String(body.channel) : null;
  // Conta alvo: admin age na empresa dona do número; os demais, na própria.
  const alvo = await resolveChatAccount(ctx, canalReq);
  const contaId = alvo.accountId;
  // Canal (caixa) da conversa para o estado. Só separa em contas multi-número;
  // conta de número único fica null (compatível com os docs legados).
  const phoneNumberId = conversationChannelKey(alvo.account, canalReq);
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
      { accountId: contaId, contact, phoneNumberId },
      {
        $set: {
          status: adiar ? "snoozed" : "pending",
          snoozedUntil,
          resolvedAt: null,
          updatedAt: now,
        },
        $setOnInsert: { accountId: contaId, contact, phoneNumberId, createdAt: now },
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
      { accountId: contaId, contact, phoneNumberId },
      {
        $set: { priority, updatedAt: now },
        $setOnInsert: {
          accountId: contaId,
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
      { accountId: contaId, contact, phoneNumberId },
      {
        $set: { labels, updatedAt: now },
        $setOnInsert: {
          accountId: contaId,
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
        ? await usersCol.findOne({ _id: oid, accountId: contaId })
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
      { accountId: contaId, contact, phoneNumberId },
      {
        $set: {
          assigneeId,
          assignedAt: assigneeId ? now : null,
          updatedAt: now,
        },
        $setOnInsert: {
          accountId: contaId,
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
    { accountId: contaId, contact, phoneNumberId },
    {
      $set: {
        status: resolvida ? "resolved" : "open",
        resolvedAt: resolvida ? now : null,
        resolvedBy: resolvida ? ctx.email ?? "" : null,
        // Reabrir também cancela adiamento pendente.
        snoozedUntil: null,
        updatedAt: now,
      },
      $setOnInsert: { accountId: contaId, contact, phoneNumberId, createdAt: now },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true, status: resolvida ? "resolved" : "open" });
}
