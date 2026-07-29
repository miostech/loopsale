import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { loopChatAccess, type LoopChatAccess } from "@/lib/billing/plans";

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
};

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
    };
  }

  const accountsCol = await getCollection("accounts");
  const oid = await routeObjectId(su.accountId);
  const account = oid
    ? ((await accountsCol.findOne({ _id: oid })) as Account | null)
    : null;

  return {
    accountId: su.accountId,
    account,
    access: loopChatAccess({
      supportActive: account?.support?.active,
      chatActive: account?.chatAddon?.active,
    }),
    role: su.role ?? "member",
    email: su.email ?? null,
    userId: su.id ?? null,
  };
}

/** Janela de atendimento da Meta: texto livre só até 24h da última recebida. */
export const JANELA_MS = 24 * 60 * 60 * 1000;

export function janelaAberta(lastInboundAt?: Date | string | null): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < JANELA_MS;
}
