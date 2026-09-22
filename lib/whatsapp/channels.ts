import type { Account, WhatsAppChannel } from "@/lib/db/types";

/**
 * Canais de WhatsApp de uma conta, normalizados. Se a conta já tem `channels`,
 * usa-os (só os que têm phoneNumberId, que é o que roteia). Senão, deriva um
 * canal único do `whatsapp` legado — assim contas antigas seguem funcionando
 * sem migração no banco.
 */
export function channelsOf(account: Account | null | undefined): WhatsAppChannel[] {
  if (!account) return [];
  const lista = account.channels?.filter((c) => c && c.phoneNumberId) ?? [];
  if (lista.length) return lista;

  const wa = account.whatsapp;
  if (wa?.phoneNumberId) {
    return [
      {
        name: wa.displayNumber?.trim() || "WhatsApp",
        source: wa.source ?? null,
        wabaId: wa.wabaId ?? null,
        phoneNumberId: wa.phoneNumberId,
        displayNumber: wa.displayNumber ?? null,
        accessToken: wa.accessToken ?? null,
        connectedAt: wa.connectedAt ?? null,
      },
    ];
  }
  return [];
}

/**
 * Acha o canal de um phoneNumberId. Sem phoneNumberId (ou não encontrado),
 * cai no primeiro canal — cobre contas de número único e o legado.
 */
export function findChannel(
  account: Account | null | undefined,
  phoneNumberId?: string | null
): WhatsAppChannel | null {
  const canais = channelsOf(account);
  if (!canais.length) return null;
  if (phoneNumberId) {
    const achado = canais.find((c) => c.phoneNumberId === phoneNumberId);
    if (achado) return achado;
  }
  return canais[0];
}

/**
 * Chave de canal para o ESTADO da conversa (status/etiquetas/responsável).
 * Só separa por número quando a conta tem mais de um canal — assim contas de
 * número único seguem usando os docs legados (phoneNumberId null), sem resetar
 * estado antigo. As MENSAGENS continuam sempre gravadas com o phoneNumberId real.
 */
export function conversationChannelKey(
  account: Account | null | undefined,
  phoneNumberId?: string | null
): string | null {
  return channelsOf(account).length > 1 ? phoneNumberId ?? null : null;
}

/** Só os campos que o `resolveSendToken` precisa, a partir de um canal. */
export function channelSendConfig(
  channel: WhatsAppChannel | null
): { accessToken?: string | null; source?: string | null } | null {
  if (!channel) return null;
  return { accessToken: channel.accessToken ?? null, source: channel.source ?? null };
}
