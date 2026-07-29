import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, mapDoc, mapDocs } from "@/lib/db";
import type { Account, MessageTemplate } from "@/lib/db/types";
import {
  createTemplate,
  tokenFor,
  usesCentralWaba,
  centralWabaId,
} from "@/lib/whatsapp/cloud";

/** Nome de template da Meta: só minúsculas, números e underscore. */
function normalizeMetaName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}

/** Maior índice {{n}} no texto = quantas variáveis o corpo pede. */
function contarVariaveis(texto: string): number {
  let maior = 0;
  for (const m of texto.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    maior = Math.max(maior, Number(m[1]));
  }
  return maior;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const templatesCol = await getCollection("messageTemplates");
  const list = await templatesCol.find({ accountId: session.user.accountId }).toArray();
  return NextResponse.json(mapDocs(list));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.accountId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const channel = String(body.channel ?? "email").toLowerCase();
  if (!["email", "whatsapp", "sms"].includes(channel)) {
    return NextResponse.json(
      { error: "Canal inválido. Use email, whatsapp ou sms." },
      { status: 400 }
    );
  }
  const name = String(body.name ?? "").trim();
  const bodyText = String(body.body ?? "").trim();
  if (!name || !bodyText) {
    return NextResponse.json(
      { error: "Nome e corpo do template são obrigatórios" },
      { status: 400 }
    );
  }

  const variables = Array.isArray(body.variables)
    ? body.variables.map((v: unknown) => String(v).trim()).filter(Boolean)
    : [];

  const language =
    channel === "whatsapp"
      ? String(body.language ?? "pt_BR").trim() || "pt_BR"
      : null;

  let metaTemplateName =
    channel === "whatsapp" && body.metaTemplateName
      ? String(body.metaTemplateName).trim()
      : null;
  let metaStatus: string | null = null;

  // Submeter à aprovação na Meta (só WhatsApp, quando o usuário pede).
  if (channel === "whatsapp" && body.submitToMeta) {
    const accountsCol = await getCollection("accounts");
    const accOid = await routeObjectId(session.user.accountId);
    const account = accOid
      ? ((await accountsCol.findOne({ _id: accOid })) as Account | null)
      : null;
    const wa = account?.whatsapp ?? null;
    const token = tokenFor(wa?.accessToken, wa?.source);
    const wabaId = usesCentralWaba(wa?.source)
      ? centralWabaId()
      : wa?.wabaId ?? "";
    if (!token || !wabaId) {
      return NextResponse.json(
        { error: "Conecte um WhatsApp em Integrações antes de enviar para aprovação." },
        { status: 400 }
      );
    }

    const metaName = normalizeMetaName(
      metaTemplateName || name
    );
    if (!metaName) {
      return NextResponse.json(
        { error: "Nome do template na Meta inválido (use letras, números e _)." },
        { status: 400 }
      );
    }
    // A Meta exige um exemplo por variável {{n}} do corpo. Usamos os rótulos
    // informados (ou um genérico) como valores de exemplo.
    const qtd = contarVariaveis(bodyText);
    const bodyExamples = Array.from(
      { length: qtd },
      (_, i) => variables[i] || `exemplo ${i + 1}`
    );
    const category = ["UTILITY", "MARKETING"].includes(
      String(body.category ?? "").toUpperCase()
    )
      ? String(body.category).toUpperCase()
      : "UTILITY";

    try {
      const res = await createTemplate({
        wabaId,
        token,
        name: metaName,
        language: language ?? "pt_BR",
        category,
        body: bodyText,
        bodyExamples,
      });
      metaTemplateName = metaName;
      metaStatus = res.status ?? "PENDING";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar para a Meta.";
      return NextResponse.json(
        { error: `A Meta recusou a submissão: ${msg}` },
        { status: 502 }
      );
    }
  }

  const now = new Date();
  const doc: MessageTemplate = {
    accountId: session.user.accountId,
    channel,
    name,
    body: bodyText,
    subject: channel === "email" ? String(body.subject ?? "Recuperação de carrinho").trim() : null,
    metaTemplateName,
    metaStatus,
    language,
    variables,
    createdAt: now,
    updatedAt: now,
  };
  const templatesCol = await getCollection("messageTemplates");
  const result = await templatesCol.insertOne(doc as MessageTemplate & { _id?: unknown });
  const inserted = await templatesCol.findOne({ _id: result.insertedId });
  return NextResponse.json(mapDoc(inserted!));
}
