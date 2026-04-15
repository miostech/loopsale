/**
 * Geração de mensagens de recuperação com IA.
 * Requer OPENAI_API_KEY no .env (opcional).
 */
export interface GenerateMessageParams {
  productName?: string;
  amount?: string;
  channel: "email" | "whatsapp" | "sms";
  tone?: "amigavel" | "urgente" | "incentivo";
}

export async function generateRecoveryMessage(
  params: GenerateMessageParams
): Promise<{ text: string; error?: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      text: "",
      error: "OPENAI_API_KEY não configurado. Configure para usar geração por IA.",
    };
  }

  const prompt = `Gere uma mensagem curta de recuperação de carrinho abandonado em português do Brasil.
Canal: ${params.channel}.
${params.productName ? `Produto: ${params.productName}.` : ""}
${params.amount ? `Valor: R$ ${params.amount}.` : ""}
Tom: ${params.tone ?? "amigavel"}.
Inclua um placeholder {{checkout_link}} onde deve ir o link do checkout.
Máximo 2-3 frases para SMS/WhatsApp, até 4 para email. Não use markdown.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
      }),
    });

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    if (!res.ok) {
      return {
        text: "",
        error: data.error?.message ?? "Erro ao chamar API de IA",
      };
    }
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    return { text: text || "Olá! Você deixou itens no carrinho. Finalize sua compra: {{checkout_link}}" };
  } catch (e) {
    return {
      text: "",
      error: e instanceof Error ? e.message : "Erro ao gerar mensagem",
    };
  }
}
