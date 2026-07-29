import { NextResponse } from "next/server";
import { getCollection, isDatabaseDisabled } from "@/lib/db";
import type { WhatsAppMessage } from "@/lib/db/types";
import { chatContext } from "@/lib/loopchat/access";
import { isDemoContext } from "@/lib/loopchat/demo";
import {
  normalizePhone,
  sendTemplate,
  listTemplates,
  preencherCorpo,
  tokenFor,
  usesCentralWaba,
  centralWabaId,
  SEM_TOKEN,
} from "@/lib/whatsapp/cloud";

/**
 * Inicia uma conversa nova mandando um template aprovado (business-initiated,
 * fora da janela de 24h). Recebe o contato, o nome do template e as variáveis.
 */
export async function POST(request: Request) {
  const ctx = await chatContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (ctx.access !== "available") {
    return NextResponse.json(
      {
        error:
          ctx.access === "hidden"
            ? "Com atendimento gerenciado, quem responde é a LoopSale."
            : "LoopChat não contratado.",
      },
      { status: ctx.access === "hidden" ? 403 : 402 }
    );
  }
  if (isDatabaseDisabled()) {
    return NextResponse.json({ error: "Indisponível no modo demo." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const contact = normalizePhone(String(body.contact ?? ""));
  const templateName = String(body.templateName ?? "").trim();
  const variables = Array.isArray(body.variables)
    ? body.variables.map((v: unknown) => String(v ?? "").trim())
    : [];
  if (!contact || !templateName) {
    return NextResponse.json(
      { error: "Informe o contato e o template." },
      { status: 400 }
    );
  }
  // Demo: finge que enviou e devolve o contato para abrir a "conversa".
  if (isDemoContext(ctx)) return NextResponse.json({ ok: true, contact });

  const wa = ctx.account?.whatsapp ?? null;
  const token = tokenFor(wa?.accessToken, wa?.source);
  const phoneNumberId = wa?.phoneNumberId ?? "";
  if (!token) {
    return NextResponse.json({ error: SEM_TOKEN }, { status: 400 });
  }

  // Confere o template na WABA: precisa existir, estar aprovado e ter todas as
  // variáveis preenchidas. Sem isso a Meta recusa o envio.
  let language = String(body.language ?? "pt_BR").trim() || "pt_BR";
  let corpoPreenchido = "";
  const wabaId = usesCentralWaba(wa?.source) ? centralWabaId() : wa?.wabaId ?? "";
  if (wabaId) {
    try {
      const todos = await listTemplates(wabaId, token);
      const tpl = todos.find(
        (t) => t.name === templateName && t.status.toUpperCase() === "APPROVED"
      );
      if (!tpl) {
        return NextResponse.json(
          { error: "Template não encontrado ou não aprovado." },
          { status: 400 }
        );
      }
      language = tpl.language || language;
      if (variables.length < tpl.variableCount) {
        return NextResponse.json(
          { error: "Preencha todas as variáveis do template." },
          { status: 400 }
        );
      }
      corpoPreenchido = preencherCorpo(tpl.body, variables);
    } catch {
      // Se a listagem falhar, segue com o envio: a Meta valida de novo.
    }
  }

  const result = await sendTemplate({
    phoneNumberId,
    to: contact,
    templateName,
    language,
    variables,
    token,
  });

  const now = new Date();
  const doc: WhatsAppMessage = {
    accountId: ctx.accountId,
    direction: "out",
    wamid: result.wamid ?? null,
    phoneNumberId,
    contact,
    type: "template",
    templateName,
    body: corpoPreenchido || `Template: ${templateName}`,
    status: result.success ? "accepted" : "failed",
    error: result.error ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const waCol = await getCollection("whatsappMessages");
  await waCol.insertOne(doc as WhatsAppMessage & { _id?: unknown });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Não foi possível enviar." },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, contact });
}
