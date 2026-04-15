import twilio from "twilio";

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;
const FROM = process.env.TWILIO_PHONE_NUMBER;

export async function sendSms(params: {
  to: string;
  body: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!client || !FROM) {
    return {
      success: false,
      error: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN ou TWILIO_PHONE_NUMBER não configurados",
    };
  }
  try {
    const to = params.to.startsWith("+") ? params.to : `+55${params.to.replace(/\D/g, "")}`;
    await client.messages.create({
      from: FROM,
      to,
      body: params.body,
    });
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao enviar SMS";
    return { success: false, error: msg };
  }
}
