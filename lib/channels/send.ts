import { sendEmail } from "./email";
import { sendSms } from "./sms";

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
      // WhatsApp real é enviado pela Cloud API (lib/whatsapp/cloud.ts), direto
      // por quem chama — nunca por aqui. Se cair aqui, é engano de roteamento.
      return {
        success: false,
        error:
          "WhatsApp não é enviado por este canal — use a Cloud API (lib/whatsapp/cloud.ts).",
      };
    }
    default:
      return { success: false, error: `Canal não suportado: ${params.channel}` };
  }
}
