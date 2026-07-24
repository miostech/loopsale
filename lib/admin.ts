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
