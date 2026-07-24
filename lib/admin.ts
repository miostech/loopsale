/**
 * Super-admin = dono da plataforma LoopSale (não confundir com o "admin" de uma
 * conta cliente). Definido por e-mail na env SUPER_ADMIN_EMAILS (separados por
 * vírgula). Só esses e-mails enxergam o painel de administração.
 */
export function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return superAdminEmails().includes(email.toLowerCase());
}

/** Custo por mensagem de WhatsApp pago à Meta, em EUR (configurável por env). */
export function metaCostPerMessageEur(): number {
  const v = Number(process.env.META_COST_PER_MESSAGE_EUR);
  return Number.isFinite(v) && v >= 0 ? v : 0.0518;
}

/** Taxa de conversão EUR -> BRL (para trazer o custo Meta ao real da margem). */
export function eurToBrlRate(): number {
  const v = Number(process.env.EUR_BRL_RATE);
  return Number.isFinite(v) && v > 0 ? v : 6.2;
}

/** Dias sem eventos para considerar a integração de uma empresa "inativa". */
export const INACTIVE_AFTER_DAYS = 7;
