/**
 * Horário de atendimento humano. O handoff (passar para um humano) só promete
 * atendimento de segunda a sexta, das 9h às 19h, no horário de Portugal. Fora
 * disso o bot avisa o horário e a conversa fica na fila para a equipe pegar
 * quando abrir.
 */

const TIMEZONE = "Europe/Lisbon";
const DIAS_UTEIS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
const HORA_INICIO = 9; // 09:00
const HORA_FIM = 19; // até 19:00 (fecha às 19h)

/** Aviso enviado ao cliente quando pede humano fora do horário. */
export const MSG_FORA_HORARIO =
  "No momento o nosso atendimento humano está fora do horário 🕐 A equipe atende de segunda a sexta, das 9h às 19h (horário de Portugal). Assim que abrirmos, a gente te responde por aqui 💙";

/** true se agora é dia útil entre 9h e 19h no horário de Portugal. */
export function handoffDisponivelAgora(d: Date = new Date()): boolean {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const dia = partes.find((p) => p.type === "weekday")?.value ?? "";
  // "24" acontece à meia-noite em alguns ambientes; normaliza para 0.
  const horaStr = partes.find((p) => p.type === "hour")?.value ?? "0";
  const hora = Number(horaStr) % 24;
  return DIAS_UTEIS.has(dia) && hora >= HORA_INICIO && hora < HORA_FIM;
}
