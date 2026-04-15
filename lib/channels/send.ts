import { sendEmail } from "./email";
import { sendSms } from "./sms";
import { sendWhatsApp } from "./whatsapp";

export type Channel = "email" | "whatsapp" | "sms";

export interface SendMessageParams {
  channel: Channel;
  to: string;
  body: string;
  subject?: string;
  variables?: Record<string, string>;
}

function applyVariables(text: string, variables?: Record<string, string>): string {
  if (!variables) return text;
  let out = text;
  for (const [key, value] of Object.entries(variables)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value ?? "");
  }
  return out;
}

export async function sendMessage(
  params: SendMessageParams
): Promise<{ success: boolean; error?: string }> {
  const body = applyVariables(params.body, params.variables);
  const to = params.to.trim();
  if (!to) return { success: false, error: "Destinatário vazio" };

  switch (params.channel) {
    case "email": {
      return sendEmail({
        to,
        subject: params.subject ?? "Recuperação de carrinho - LoopSale",
        body,
      });
    }
    case "sms": {
      return sendSms({ to, body });
    }
    case "whatsapp": {
      return sendWhatsApp({ to, body });
    }
    default:
      return { success: false, error: `Canal não suportado: ${params.channel}` };
  }
}
