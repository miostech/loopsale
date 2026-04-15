import twilio from "twilio";

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;
const FROM = process.env.TWILIO_WHATSAPP_NUMBER ?? process.env.TWILIO_PHONE_NUMBER;
const WHATSAPP_PREFIX = "whatsapp:";

export async function sendWhatsApp(params: {
  to: string;
  body: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!client || !FROM) {
    return {
      success: false,
      error: "Twilio não configurado ou TWILIO_WHATSAPP_NUMBER ausente",
    };
  }
  try {
    const to = params.to.startsWith("+")
      ? params.to
      : `+55${params.to.replace(/\D/g, "")}`;
    const from = FROM.startsWith(WHATSAPP_PREFIX)
      ? FROM
      : `${WHATSAPP_PREFIX}${FROM}`;
    const toWa = to.startsWith(WHATSAPP_PREFIX) ? to : `${WHATSAPP_PREFIX}${to}`;
    await client.messages.create({
      from,
      to: toWa,
      body: params.body,
    });
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao enviar WhatsApp";
    return { success: false, error: msg };
  }
}
