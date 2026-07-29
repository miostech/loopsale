/**
 * Autoriza uma chamada de cron. Aceita dois formatos para funcionar tanto no
 * disparo manual quanto no Vercel Cron:
 *  - `?secret=<CRON_SECRET>` na query (chamada manual/curl);
 *  - header `Authorization: Bearer <CRON_SECRET>` (o que a Vercel envia).
 *
 * Sem CRON_SECRET definido, nega — nunca deixa um cron aberto por falta de env.
 */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(request.url);
  const queryOk = url.searchParams.get("secret") === secret;
  const headerOk = request.headers.get("authorization") === `Bearer ${secret}`;
  return queryOk || headerOk;
}
