import type { ObjectId } from "mongodb";
import { getCollection } from "@/lib/db";
import type { ChatExample } from "@/lib/db/types";
import type { AttendantExample } from "@/lib/ai/attendant";

const MAX_GUARDADOS = 500; // teto por conta pra não crescer sem limite

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/**
 * Guarda um exemplo (pergunta do cliente → resposta humana). Evita duplicar a
 * mesma resposta seguida e apara o histórico no teto por conta.
 */
export async function salvarExemplo(
  accountId: string,
  question: string,
  answer: string
): Promise<void> {
  const q = question.trim();
  const a = answer.trim();
  if (!q || !a) return;
  const col = await getCollection("chatExamples");
  // Não repete o último par idêntico.
  const ultimo = (await col
    .find({ accountId })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as ChatExample[];
  if (ultimo[0]?.question === q && ultimo[0]?.answer === a) return;

  await col.insertOne({
    accountId,
    question: q.slice(0, 500),
    answer: a.slice(0, 1000),
    createdAt: new Date(),
  } as ChatExample);

  // Poda o excedente (mais antigos primeiro).
  const total = await col.countDocuments({ accountId });
  if (total > MAX_GUARDADOS) {
    const antigos = (await col
      .find({ accountId })
      .sort({ createdAt: 1 })
      .limit(total - MAX_GUARDADOS)
      .project({ _id: 1 })
      .toArray()) as { _id: ObjectId }[];
    if (antigos.length) {
      await col.deleteMany({ _id: { $in: antigos.map((d) => d._id) } });
    }
  }
}

/**
 * Exemplos mais relevantes para a mensagem atual do cliente: ranqueia por
 * palavras em comum com a pergunta guardada, desempatando pela mais recente.
 */
export async function buscarExemplos(
  accountId: string,
  textoCliente: string,
  limite = 4
): Promise<AttendantExample[]> {
  const col = await getCollection("chatExamples");
  const recentes = (await col
    .find({ accountId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()) as ChatExample[];
  if (!recentes.length) return [];

  const alvo = new Set(tokens(textoCliente));
  if (!alvo.size) return [];

  const rankeados = recentes
    .map((e, i) => {
      const t = tokens(e.question);
      let score = 0;
      for (const w of t) if (alvo.has(w)) score++;
      return { e, score, i };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limite);

  return rankeados.map((r) => ({ question: r.e.question, answer: r.e.answer }));
}
