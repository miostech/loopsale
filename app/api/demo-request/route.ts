import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/channels/email";

const DEMO_EMAIL = process.env.DEMO_REQUEST_EMAIL;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      nome,
      email,
      contato,
      negocio,
      plataforma,
      faturamento,
      clientes,
      necessidade,
    } = body;

    if (!nome || !email) {
      return NextResponse.json(
        { error: "Nome e e-mail são obrigatórios." },
        { status: 400 }
      );
    }

    if (DEMO_EMAIL) {
      const faturamentoLabels: Record<string, string> = {
        "ate-50k": "Até R$ 50.000",
        "50k-250k": "De R$ 50k a R$ 250k",
        "250k-500k": "De R$ 250k a R$ 500k",
        "500k-1mi": "De R$ 500k a R$ 1mi",
        "acima-1mi": "Acima de R$ 1mi",
      };
      const plataformaLabels: Record<string, string> = {
        kiwify: "Kiwify",
        hotmart: "Hotmart",
        outro: "Outro",
      };

      const text = [
        "Nova solicitação de demo - LoopSale",
        "",
        `Nome: ${nome}`,
        `E-mail: ${email}`,
        `Contato: ${contato || "-"}`,
        `Negócio/Infoproduto: ${negocio || "-"}`,
        `Plataforma: ${plataformaLabels[plataforma] || plataforma || "-"}`,
        `Faturamento: ${faturamentoLabels[faturamento] || faturamento || "-"}`,
        `Clientes/leads: ${clientes || "-"}`,
        `Necessidade: ${necessidade || "-"}`,
      ].join("\n");

      await sendEmail({
        to: DEMO_EMAIL,
        subject: `[LoopSale] Nova solicitação de demo - ${nome}`,
        body: text,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("demo-request error:", e);
    return NextResponse.json(
      { error: "Erro ao processar solicitação." },
      { status: 500 }
    );
  }
}
