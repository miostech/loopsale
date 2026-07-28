import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCollection, routeObjectId, isDatabaseDisabled } from "@/lib/db";
import type { Account } from "@/lib/db/types";
import { N8nCard } from "./N8nCard";
import { CredentialCard, type CredentialField } from "./CredentialCard";

const KIWIFY_FIELDS: CredentialField[] = [
  {
    key: "accountId",
    label: "Account ID (ID da conta Kiwify)",
    secret: false,
    placeholder: "ex: 3fb8eb20-7bb0-...",
  },
  {
    key: "clientId",
    label: "Client ID (chave da API)",
    secret: false,
  },
  {
    key: "clientSecret",
    label: "Client Secret (segredo da API)",
    secret: true,
  },
];

const HOTMART_FIELDS: CredentialField[] = [
  { key: "clientId", label: "Client ID", secret: false },
  { key: "clientSecret", label: "Client Secret", secret: true },
  { key: "hottok", label: "Hottok (token do webhook)", secret: true },
];

const PLATFORM_LABEL: Record<string, string> = {
  kiwify: "Kiwify",
  hotmart: "Hotmart",
};

export default async function IntegracoesPage() {
  // Descobre a plataforma escolhida no cadastro e o plano — para o plano grátis
  // liberar só 1 plataforma (a escolhida) e bloquear a outra.
  let chosen: string | null = null;
  let plan = "free";
  const session = await getServerSession(authOptions);
  const accountId = session?.user?.accountId;
  if (accountId && !isDatabaseDisabled()) {
    const accountsCol = await getCollection("accounts");
    const oid = await routeObjectId(accountId);
    const account = oid
      ? ((await accountsCol.findOne({ _id: oid })) as Account | null)
      : null;
    chosen = account?.platform ?? null;
    plan = account?.subscription?.plan ?? "free";
  }
  const isFree = plan === "free";

  // No plano grátis, só a plataforma escolhida fica liberada.
  function lockFor(p: "kiwify" | "hotmart") {
    if (isFree && chosen && p !== chosen) {
      return {
        locked: true,
        lockedReason: `O plano grátis permite conectar apenas 1 plataforma (você escolheu ${PLATFORM_LABEL[chosen] ?? chosen}). Faça upgrade para conectar a ${PLATFORM_LABEL[p]} também.`,
      };
    }
    return { locked: false, lockedReason: undefined };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--loop-text)]">
          Integrações
        </h1>
        <p className="text-sm text-[var(--loop-text-muted)]">
          Conecte suas plataformas para o LoopSale receber os eventos e medir a
          recuperação.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <N8nCard />
        <CredentialCard
          platform="kiwify"
          title="Kiwify"
          description="Informe as chaves geradas na sua conta Kiwify para consultar vendas e validar webhooks."
          fields={KIWIFY_FIELDS}
          {...lockFor("kiwify")}
        />
        <CredentialCard
          platform="hotmart"
          title="Hotmart"
          description="Informe as credenciais da API Hotmart e o token do webhook (hottok)."
          fields={HOTMART_FIELDS}
          {...lockFor("hotmart")}
        />
      </div>
    </div>
  );
}
