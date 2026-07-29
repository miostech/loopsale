/**
 * Canal de SMS. Ainda sem provedor conectado — o Twilio foi descontinuado no
 * projeto. Mantém a assinatura para os fluxos que oferecem "SMS", mas retorna
 * um erro claro em vez de falhar de forma silenciosa ou carregar dependência
 * morta. Para reativar: plugar um provedor (ex: Twilio, Zenvia) aqui dentro.
 */
export async function sendSms(_params: {
  to: string;
  body: string;
}): Promise<{ success: boolean; error?: string }> {
  return {
    success: false,
    error: "Canal de SMS ainda não disponível — nenhum provedor conectado.",
  };
}
