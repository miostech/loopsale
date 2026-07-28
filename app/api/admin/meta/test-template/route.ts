import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  centralWabaId,
  centralToken,
  createTemplate,
} from "@/lib/whatsapp/cloud";

// Basta estar logado — serve a /meta-review, aberta a qualquer usuário.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const wabaId = centralWabaId();
  const token = centralToken();
  if (!wabaId || !token) {
    return NextResponse.json(
      { error: "WHATSAPP_WABA_ID / WHATSAPP_ACCESS_TOKEN não configurados." },
      { status: 400 }
    );
  }
  const name = `loopsale_teste_${Date.now()}`;
  try {
    const result = await createTemplate({
      wabaId,
      token,
      name,
      language: "pt_BR",
      category: "UTILITY",
      body: "Olá! Este é um template de teste da LoopSale para validação da integração.",
    });
    return NextResponse.json({ ok: true, name, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro", name },
      { status: 502 }
    );
  }
}
