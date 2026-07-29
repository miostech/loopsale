import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import {
  loopChatAccess,
  chatFreeConversationsOf,
  type LoopChatAccess,
} from "@/lib/billing/plans";

type SessionUser = {
  id?: string;
  accountId?: string;
  role?: string;
  email?: string | null;
};

export type ChatContext = {
  accountId: string;
  account: Account | null;
  access: LoopChatAccess;
  role: string;
  /** Quem está agindo — registrado ao resolver uma conversa. */
  email: string | null;
  /** Id do usuário logado, para saber o que é "minha conversa". */
  userId: string | null;
  /** Cota de conversas grátis/mês do plano (null = ilimitado). */
  chatQuota: number | null;
  /** Contatos ativos no mês corrente (0 quando não precisou contar). */
  monthlyConversations: number;
};

/** Contatos distintos que trocaram ≥1 mensagem no mês corrente. */
async function contarConversasDoMes(accountId: string): Promise<number> {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const waCol = await getCollection("whatsappMessages");
  const rows = (await waCol
    .aggregate([
      {
        $match: {
          accountId,
          contact: { $ne: null },
          internal: { $ne: true },
          createdAt: { $gte: inicioMes },
        },
      },
      { $group: { _id: "$contact" } },
      { $count: "n" },
    ])
    .toArray()) as { n?: number }[];
  return rows[0]?.n ?? 0;
}

/**
 * Resolve conta + acesso ao LoopChat numa chamada só. Página e rotas usam o
 * mesmo caminho para não divergirem sobre quem pode ver o quê.
 */
export async function chatContext(): Promise<ChatContext | null> {
  const session = await getServerSession(authOptions);
  const su = session?.user as SessionUser | undefined;
  if (!su?.accountId) return null;

  if (isDatabaseDisabled()) {
    return {
      accountId: su.accountId,
      account: null,
      access: "locked",
      role: su.role ?? "member",
      email: su.email ?? null,
      userId: su.id ?? null,
      chatQuota: 0,
      monthlyConversations: 0,
    };
  }

  const accountsCol = await getCollection("accounts");
  const oid = await routeObjectId(su.accountId);
  const account = oid
    ? ((await accountsCol.findOne({ _id: oid })) as Account | null)
    : null;

  const planId = account?.subscription?.plan ?? null;
  const supportActive = !!account?.support?.active;
  const chatActive = !!account?.chatAddon?.active;
  const chatQuota = chatFreeConversationsOf(planId);

  // Só conta conversas quando o acesso realmente depende da cota do plano:
  // não é demo, não tem atendimento gerenciado, não contratou o add-on e o
  // plano tem cota finita > 0 (Pro/Escala). Nos outros casos a contagem seria
  // uma query desperdiçada em toda navegação.
  let monthlyConversations = 0;
  if (
    account &&
    !account.isDemo &&
    !supportActive &&
    !chatActive &&
    chatQuota !== null &&
    chatQuota > 0
  ) {
    monthlyConversations = await contarConversasDoMes(su.accountId);
  }

  return {
    accountId: su.accountId,
    account,
    // Conta demo sempre entra no LoopChat (com dados falsos) — é uma vitrine.
    access: account?.isDemo
      ? "available"
      : loopChatAccess({
          supportActive,
          chatActive,
          planId,
          monthlyConversations,
        }),
    role: su.role ?? "member",
    email: su.email ?? null,
    userId: su.id ?? null,
    chatQuota,
    monthlyConversations,
  };
}

/** Janela de atendimento da Meta: texto livre só até 24h da última recebida. */
export const JANELA_MS = 24 * 60 * 60 * 1000;

export function janelaAberta(lastInboundAt?: Date | string | null): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < JANELA_MS;
}
