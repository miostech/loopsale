/**
 * Robô de atendimento do WhatsApp (IA). Gera a resposta a uma conversa com base
 * nas instruções e na base de conhecimento configuradas para a conta.
 *
 * Modelo híbrido com repasse: o próprio modelo decide quando transferir para um
 * humano (dúvida fora da base, pedido de pessoa, reclamação/reembolso, etc.).
 *
 * Requer ANTHROPIC_API_KEY no ambiente. Sem a chave, não responde (deixa para o
 * time humano) em vez de mandar qualquer coisa.
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
// Haiku: rápido e barato, suficiente para FAQ/objeções. Trocável se precisar.
const MODEL = "claude-haiku-4-5-20251001";

export interface AttendantTurn {
  role: "customer" | "assistant";
  text: string;
}

export interface AttendantResult {
  reply: string;
  handoff: boolean;
  error?: string;
}

function montarSystem(params: {
  instructions?: string | null;
  knowledge?: string | null;
}): string {
  return [
    "Você é um assistente de atendimento no WhatsApp de um infoprodutor/loja digital.",
    "Responda em português do Brasil, de forma breve, cordial e natural (1 a 3 frases, sem markdown, sem listas).",
    "",
    "SUAS INSTRUÇÕES:",
    params.instructions?.trim() || "(sem instruções específicas)",
    "",
    "BASE DE CONHECIMENTO (use apenas o que estiver aqui; não invente):",
    params.knowledge?.trim() || "(base vazia)",
    "",
    "REGRAS:",
    "- Transfira para um humano (handoff=true) quando: não souber responder com segurança pela base; o cliente pedir para falar com uma pessoa/atendente; for reclamação séria, pedido de reembolso, cobrança, ou algo fora do seu escopo.",
    "- Nunca invente preços, prazos, políticas ou links que não estejam na base.",
    "- Não repita saudações a cada mensagem; siga a conversa naturalmente.",
    "",
    'Responda SOMENTE com um objeto JSON, sem nenhum texto fora dele, no formato: {"handoff": <true|false>, "reply": "<mensagem para o cliente>"}.',
    'Quando handoff for true, "reply" deve ser uma frase curta avisando que vai transferir (ex: "Só um instante, vou te passar para um atendente 🙌").',
  ].join("\n");
}

export async function generateAttendantReply(params: {
  instructions?: string | null;
  knowledge?: string | null;
  history: AttendantTurn[];
}): Promise<AttendantResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { reply: "", handoff: false, error: "ANTHROPIC_API_KEY não configurado." };
  }
  if (!params.history.length) {
    return { reply: "", handoff: false, error: "Sem histórico para responder." };
  }

  const messages = params.history.map((t) => ({
    role: t.role === "customer" ? "user" : "assistant",
    content: t.text,
  }));
  // Prefill "{" força o modelo a começar o JSON — mais confiável de parsear.
  messages.push({ role: "assistant", content: "{" });

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: montarSystem(params),
        messages,
      }),
    });
    const data = (await res.json()) as {
      content?: { text?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { reply: "", handoff: false, error: data.error?.message ?? "Erro na API de IA." };
    }
    const bruto = "{" + (data.content?.[0]?.text ?? "");
    try {
      const parsed = JSON.parse(bruto) as { handoff?: boolean; reply?: string };
      const reply = String(parsed.reply ?? "").trim();
      const handoff = !!parsed.handoff;
      if (!reply) {
        // Sem texto utilizável: melhor transferir do que ficar mudo.
        return { reply: "", handoff: true };
      }
      return { reply, handoff };
    } catch {
      // JSON malformado: não arrisca uma resposta estranha — deixa para humano.
      return { reply: "", handoff: false, error: "Resposta da IA em formato inesperado." };
    }
  } catch (e) {
    return {
      reply: "",
      handoff: false,
      error: e instanceof Error ? e.message : "Erro ao chamar a IA.",
    };
  }
}
