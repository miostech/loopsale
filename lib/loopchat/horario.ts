/**
 * Horário de atendimento humano. O handoff (passar para um humano) só promete
 * atendimento dentro da janela configurada por empresa. Fora disso o bot avisa
 * o horário e a conversa fica na fila para a equipe pegar quando abrir.
 *
 * Config em account.attendantBot.handoffHours:
 *  - ausente  → padrão: seg-sex, 9h-19h, Europe/Lisbon.
 *  - enabled=false → sem restrição (handoff sempre disponível).
 */

export type HandoffHours = {
  enabled?: boolean;
  timezone?: string | null;
  days?: number[]; // 0=domingo … 6=sábado
  start?: number; // hora 0-23
  end?: number; // hora 1-24
} | null;

const PADRAO = {
  timezone: "Europe/Lisbon",
  days: [1, 2, 3, 4, 5], // seg a sex
  start: 9,
  end: 19,
};

const NOMES_DIA = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Aviso enviado ao cliente quando pede humano fora do horário. */
export const MSG_FORA_HORARIO =
  "No momento o nosso atendimento humano está fora do horário 🕐 A equipe atende dentro do horário comercial. Assim que abrirmos, a gente te responde por aqui 💙";

/** Dia (0-6) e hora (0-23) de uma data num fuso IANA. */
function diaHoraNoFuso(d: Date, timezone: string): { dia: number; hora: number } {
  let partes: Intl.DateTimeFormatPart[];
  try {
    partes = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(d);
  } catch {
    // Fuso inválido: cai no padrão.
    partes = new Intl.DateTimeFormat("en-US", {
      timeZone: PADRAO.timezone,
      weekday: "short",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(d);
  }
  const nomeDia = partes.find((p) => p.type === "weekday")?.value ?? "";
  const dia = Math.max(0, NOMES_DIA.indexOf(nomeDia));
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "0") % 24;
  return { dia, hora };
}

/** true se agora está dentro da janela de atendimento humano da conta. */
export function handoffDisponivelAgora(
  config?: HandoffHours,
  d: Date = new Date()
): boolean {
  // Sem restrição ligada = handoff sempre disponível.
  if (!config?.enabled) return true;

  const timezone = config?.timezone?.trim() || PADRAO.timezone;
  const days = config?.days?.length ? config.days : PADRAO.days;
  const start = Number.isFinite(config?.start) ? (config!.start as number) : PADRAO.start;
  const end = Number.isFinite(config?.end) ? (config!.end as number) : PADRAO.end;

  const { dia, hora } = diaHoraNoFuso(d, timezone);
  return days.includes(dia) && hora >= start && hora < end;
}
