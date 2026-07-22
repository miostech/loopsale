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

export default function IntegracoesPage() {
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
        />
        <CredentialCard
          platform="hotmart"
          title="Hotmart"
          description="Informe as credenciais da API Hotmart e o token do webhook (hottok)."
          fields={HOTMART_FIELDS}
        />
      </div>
    </div>
  );
}
